import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { randomBytes } from "node:crypto";
import { isAddress, verifyMessage } from "viem";

// Lightweight wallet-signature auth: issue a single-use nonce, the client signs
// a fixed message containing it, we verify the signature recovers to the claimed
// address. Enough to prove ownership for profile edits without passwords.

const TTL_MS = 10 * 60 * 1000;
const nonces = new Map<string, { nonce: string; exp: number }>();

const messageFor = (address: string, nonce: string) =>
  `BINGOChain\n\nSign in to update your profile.\n\nAddress: ${address}\nNonce: ${nonce}`;

const clean = (s: unknown, max: number): string | null => {
  if (s == null) return null;
  const v = String(s).trim();
  return v ? v.slice(0, max) : null;
};

// Avatar is either a compact inline image (data:image/...;base64, capped ~64KB)
// or an https image URL. Anything else is rejected and stored as null.
const cleanAvatar = (s: unknown): string | null => {
  if (s == null) return null;
  const v = String(s).trim();
  if (!v) return null;
  if (v.startsWith("data:image/")) return v.length <= 64_000 ? v : null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && v.length <= 512 ? v : null;
  } catch {
    return null;
  }
};

export function registerProfileRoutes(app: FastifyInstance, pool: Pool) {
  // Batch profile lookup so the UI can resolve many addresses → names in one call.
  app.get<{ Querystring: { addresses?: string } }>("/api/profiles", async (req) => {
    const addrs = (req.query.addresses ?? "")
      .split(",")
      .map((a) => a.trim().toLowerCase())
      .filter((a) => isAddress(a))
      .slice(0, 100);
    if (!addrs.length) return [];
    const { rows } = await pool.query(
      `select address, name, avatar_seed, avatar_url from players
       where address = any($1) and (name is not null or avatar_url is not null)`,
      [addrs],
    );
    return rows;
  });

  app.get<{ Params: { address: string } }>("/api/auth/nonce/:address", async (req, reply) => {
    const address = req.params.address.toLowerCase();
    if (!isAddress(address)) return reply.code(400).send({ error: "bad_address" });
    const nonce = randomBytes(16).toString("hex");
    nonces.set(address, { nonce, exp: Date.now() + TTL_MS });
    return { address, nonce, message: messageFor(address, nonce) };
  });

  app.put<{
    Params: { address: string };
    Body: { name?: string; avatarSeed?: string; avatarUrl?: string; bio?: string; signature?: string };
  }>("/api/profile/:address", async (req, reply) => {
    const address = req.params.address.toLowerCase();
    if (!isAddress(address)) return reply.code(400).send({ error: "bad_address" });

    const { name, avatarSeed, avatarUrl, bio, signature } = req.body ?? {};
    if (!signature) return reply.code(400).send({ error: "signature_required" });

    const entry = nonces.get(address);
    if (!entry || entry.exp < Date.now()) return reply.code(401).send({ error: "nonce_expired" });

    let ok = false;
    try {
      ok = await verifyMessage({
        address: address as `0x${string}`,
        message: messageFor(address, entry.nonce),
        signature: signature as `0x${string}`,
      });
    } catch {
      ok = false;
    }
    if (!ok) return reply.code(401).send({ error: "bad_signature" });
    nonces.delete(address); // single-use

    const { rows } = await pool.query(
      `insert into players(address, name, avatar_seed, avatar_url, bio, updated_at)
       values($1,$2,$3,$4,$5, now())
       on conflict (address) do update set
         name=excluded.name, avatar_seed=excluded.avatar_seed,
         avatar_url=excluded.avatar_url, bio=excluded.bio, updated_at=now()
       returning address, name, avatar_seed, avatar_url, bio`,
      [address, clean(name, 32), clean(avatarSeed, 64), cleanAvatar(avatarUrl), clean(bio, 200)],
    );
    return rows[0];
  });
}
