import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { isAddress } from "viem";
import { celoClient } from "./chain.ts";

// Constant-time string compare (timingSafeEqual throws on length mismatch).
const timingSafeEqualStr = (a: string, b: string): boolean => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

// Referral / invite + reward system. A wallet's invite link carries its address
// as ?ref=; when an invited wallet first connects, the client records the pair
// here. One inviter per referree (referree is PK), never self.
//
// A reward is now attached, so recording is SIWE-gated: the referree must sign a
// nonce message proving wallet ownership (mirrors profiles.ts) before we credit
// their inviter. The reward is REWARD_LANCE $LANCE to the inviter per QUALIFIED
// referree — a referree qualifies once they have >=1 settled game (a player_matches
// row with outcome win|loss). The reward is off-chain and operator-funded: we track
// qualification + payout here and the operator pays $LANCE manually.

// Flat reward, in WHOLE $LANCE, credited to the inviter per qualified referree.
const REWARD_LANCE = 25;

// SIWE nonce store, same shape/TTL as profiles.ts but keyed for referral confirms
// so a profile-edit nonce can't be replayed here and vice versa.
const TTL_MS = 10 * 60 * 1000;
const nonces = new Map<string, { nonce: string; exp: number }>();

// Sybil-farm bound: the SIWE only proves the referree owns its wallet, not a
// genuine invite, so one entity controlling many wallets could self-refer without
// limit. Cap how many qualified referrees a single referrer is REWARDED for; the
// manual mark-paid review stays the final gate. Tune via env.
const MAX_REWARDED_PER_REFERRER = Number(process.env.REFERRAL_MAX_PER_REFERRER ?? 50);

// Best-effort in-memory per-IP rate limit for the public referral endpoints.
// Needs Fastify trustProxy so req.ip is the real client behind Railway's proxy.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
const hits = new Map<string, { n: number; resetAt: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const e = hits.get(ip);
  if (!e || e.resetAt < now) {
    hits.set(ip, { n: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  e.n += 1;
  return e.n > RATE_MAX;
}

// Sweep expired nonces + rate buckets so neither map grows unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of nonces) if (v.exp < now) nonces.delete(k);
  for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
}, 60_000).unref?.();

// The referree signs this to confirm their inviter. Binds both addresses + nonce
// so a signature for one (referree, inviter) pair can't be reused for another.
const messageFor = (referree: string, referrer: string, nonce: string) =>
  `BINGOChain\n\nConfirm your inviter.\n\nAddress: ${referree}\nInviter: ${referrer}\nNonce: ${nonce}`;

// Mark referrees qualified once they have a settled game, and credit the reward.
// Idempotent: only flips rows that are not yet qualified. Exported so the indexer
// can refresh on each poll tick, and called lazily on the per-address read.
export async function refreshReferralQualifications(pool: Pool) {
  // Qualify a referree once it has a settled game, but only up to
  // MAX_REWARDED_PER_REFERRER per referrer (the earliest by address) so a sybil
  // farm cannot mint unbounded rewards to one inviter.
  await pool.query(
    `update referrals r
     set qualified = true, qualified_at = now(), reward_amount = $1
     from (
       select referree from (
         select x.referree,
                row_number() over (partition by x.referrer order by x.referree) as rn
         from referrals x
         where x.referree in (
           select distinct player_address from player_matches where outcome in ('win','loss')
         )
       ) ranked
       where ranked.rn <= $2
     ) eligible
     where r.referree = eligible.referree and not r.qualified`,
    [REWARD_LANCE, MAX_REWARDED_PER_REFERRER],
  );
}

export function registerReferralRoutes(app: FastifyInstance, pool: Pool) {
  // Dedicated nonce for confirming an inviter — the referree calls this, signs the
  // returned message, then posts the signature to /api/referral.
  app.get<{ Params: { address: string } }>("/api/auth/referral-nonce/:address", async (req, reply) => {
    if (rateLimited(req.ip)) return reply.code(429).send({ error: "rate_limited" });
    const address = req.params.address.toLowerCase();
    if (!isAddress(address)) return reply.code(400).send({ error: "bad_address" });
    const nonce = randomBytes(16).toString("hex");
    nonces.set(address, { nonce, exp: Date.now() + TTL_MS });
    return { address, nonce };
  });

  app.post<{ Body: { referrer?: string; referree?: string; signature?: string } }>("/api/referral", async (req, reply) => {
    if (rateLimited(req.ip)) return reply.code(429).send({ error: "rate_limited" });
    const referrer = String(req.body?.referrer ?? "").toLowerCase();
    const referree = String(req.body?.referree ?? "").toLowerCase();
    if (!isAddress(referrer) || !isAddress(referree)) return reply.code(400).send({ error: "bad_address" });
    if (referrer === referree) return reply.code(400).send({ error: "self_referral" });

    // SECURITY (sybil farm): this SIWE proves only that the *referree* owns its
    // wallet, NOT that `referrer` genuinely invited anyone, so one entity with many
    // wallets could self-refer. Mitigations now in place: rewards are capped per
    // referrer (MAX_REWARDED_PER_REFERRER), these endpoints are rate-limited, and
    // every payout goes through the manual /referrals/mark-paid review, which stays
    // the final gate before any real $LANCE moves.
    // SIWE-gate: the referree proves wallet ownership by signing the nonce message.
    const signature = req.body?.signature;
    if (!signature) return reply.code(400).send({ error: "signature_required" });
    const entry = nonces.get(referree);
    if (!entry || entry.exp < Date.now()) return reply.code(401).send({ error: "nonce_expired" });
    let ok = false;
    try {
      ok = await celoClient.verifyMessage({
        address: referree as `0x${string}`,
        message: messageFor(referree, referrer, entry.nonce),
        signature: signature as `0x${string}`,
      });
    } catch {
      ok = false;
    }
    if (!ok) return reply.code(401).send({ error: "bad_signature" });
    nonces.delete(referree); // single-use

    const { rows } = await pool.query(
      `insert into referrals(referree, referrer) values($1,$2)
       on conflict (referree) do nothing
       returning referree`,
      [referree, referrer],
    );
    return { ok: true, status: rows.length ? "recorded" : "already_referred", referrer, referree };
  });

  app.get<{ Params: { address: string } }>("/api/referral/:address", async (req, reply) => {
    if (rateLimited(req.ip)) return reply.code(429).send({ error: "rate_limited" });
    const address = req.params.address.toLowerCase();
    if (!isAddress(address)) return reply.code(400).send({ error: "bad_address" });
    // Read-only: the indexer calls refreshReferralQualifications every poll tick, so
    // this stays at most ~POLL_MS stale. Doing the table-wide UPDATE here would let
    // any unauthenticated caller drive write amplification on every request.
    const invited = await pool.query("select count(*)::int as n from referrals where referrer=$1", [address]);
    const qualified = await pool.query(
      "select count(*)::int as n from referrals where referrer=$1 and qualified",
      [address],
    );
    // Earned = reward already paid out; pending = qualified but not yet paid.
    const earned = await pool.query(
      "select coalesce(sum(reward_amount),0) as v from referrals where referrer=$1 and reward_paid",
      [address],
    );
    const pending = await pool.query(
      "select coalesce(sum(reward_amount),0) as v from referrals where referrer=$1 and qualified and not reward_paid",
      [address],
    );
    const by = await pool.query("select referrer from referrals where referree=$1", [address]);
    return {
      address,
      invitedCount: invited.rows[0].n,
      qualifiedInvites: qualified.rows[0].n,
      earnedLance: String(earned.rows[0].v),
      pendingLance: String(pending.rows[0].v),
      invitedBy: by.rows[0]?.referrer ?? null,
    };
  });

  app.get<{ Querystring: { limit?: string } }>("/api/referrals/leaderboard", async (req) => {
    const limit = Math.min(Number(req.query.limit ?? 20), 100);
    const { rows } = await pool.query(
      `select r.referrer as address, p.name, count(*)::int as invites
       from referrals r left join players p on p.address = r.referrer
       group by r.referrer, p.name
       order by invites desc limit $1`,
      [limit],
    );
    return rows.map((r, i) => ({ rank: i + 1, address: r.address, name: r.name, invites: Number(r.invites) }));
  });

  // Admin: list/settle pending payouts. Gated by REFERRAL_ADMIN_KEY (env). When
  // unset the endpoints are disabled (503); otherwise the key must arrive in the
  // x-admin-key header only (never a query param, which Fastify's logger would
  // write to logs in cleartext).
  const adminGuard = (
    req: { headers: Record<string, unknown> },
    reply: { code: (c: number) => { send: (b: unknown) => unknown } },
  ): boolean => {
    const expected = process.env.REFERRAL_ADMIN_KEY;
    if (!expected) {
      reply.code(503).send({ error: "admin_disabled" });
      return false;
    }
    const provided = req.headers["x-admin-key"];
    if (typeof provided !== "string" || !timingSafeEqualStr(provided, expected)) {
      reply.code(401).send({ error: "unauthorized" });
      return false;
    }
    return true;
  };

  // Rows ready to be paid: qualified but not yet paid out.
  app.get("/api/referrals/payable", async (req, reply) => {
    if (!adminGuard(req, reply)) return reply;
    const { rows } = await pool.query(
      `select referrer, referree, reward_amount from referrals
       where qualified and not reward_paid
       order by qualified_at asc nulls last`,
    );
    return rows.map((r) => ({ referrer: r.referrer, referree: r.referree, amount: String(r.reward_amount) }));
  });

  // Mark a referree's reward as paid, recording the payout tx hash.
  app.post<{ Body: { referree?: string; tx?: string } }>(
    "/api/referrals/mark-paid",
    async (req, reply) => {
      if (!adminGuard(req, reply)) return reply;
      const referree = String(req.body?.referree ?? "").toLowerCase();
      const tx = req.body?.tx ? String(req.body.tx) : null;
      if (!isAddress(referree)) return reply.code(400).send({ error: "bad_address" });
      await pool.query("update referrals set reward_paid=true, reward_tx=$2 where referree=$1", [referree, tx]);
      return { ok: true };
    },
  );
}
