import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { isAddress } from "viem";

// Referral / invite system. A wallet's invite link carries its address as ?ref=;
// when an invited wallet first connects, the client records the pair here. One
// inviter per referree (referree is PK), never self. Social-only in v1 — no
// reward — so recording is not signature-gated; the worst abuse is an inflated
// invite count. Gate with SIWE here if a reward is ever attached.
export function registerReferralRoutes(app: FastifyInstance, pool: Pool) {
  app.post<{ Body: { referrer?: string; referree?: string } }>("/api/referral", async (req, reply) => {
    const referrer = String(req.body?.referrer ?? "").toLowerCase();
    const referree = String(req.body?.referree ?? "").toLowerCase();
    if (!isAddress(referrer) || !isAddress(referree)) return reply.code(400).send({ error: "bad_address" });
    if (referrer === referree) return reply.code(400).send({ error: "self_referral" });
    const { rows } = await pool.query(
      `insert into referrals(referree, referrer) values($1,$2)
       on conflict (referree) do nothing
       returning referree`,
      [referree, referrer],
    );
    return { ok: true, status: rows.length ? "recorded" : "already_referred", referrer, referree };
  });

  app.get<{ Params: { address: string } }>("/api/referral/:address", async (req, reply) => {
    const address = req.params.address.toLowerCase();
    if (!isAddress(address)) return reply.code(400).send({ error: "bad_address" });
    const invited = await pool.query("select count(*)::int as n from referrals where referrer=$1", [address]);
    const by = await pool.query("select referrer from referrals where referree=$1", [address]);
    return { address, invitedCount: invited.rows[0].n, invitedBy: by.rows[0]?.referrer ?? null };
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
}
