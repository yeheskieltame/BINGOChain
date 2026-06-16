import Fastify from "fastify";
import cors from "@fastify/cors";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatEther } from "viem";
import pg from "pg";
import { startIndexer } from "./indexer.ts";

const __dir = dirname(fileURLToPath(import.meta.url));

// Railway gives DATABASE_URL (public proxy, needs SSL) and a *.railway.internal
// private URL (no SSL). Detect which one we got and configure TLS accordingly.
const connectionString = process.env.DATABASE_URL;
const isInternal = !!connectionString && connectionString.includes("railway.internal");
const pool = new pg.Pool({
  connectionString,
  ssl: connectionString && !isInternal ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

// On-chain amounts are stored raw (wei); games run in 18-decimal $LANCE so we
// format with formatEther for display.
const fmt = (v: string | number | null) => (v == null ? "0" : formatEther(BigInt(v)));

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

app.get("/api/health", async () => {
  let db = "down";
  try {
    await pool.query("select 1");
    db = "up";
  } catch (e) {
    app.log.error(e);
  }
  return { ok: true, service: "bingochain-api", db, ts: new Date().toISOString() };
});

app.get("/api/leaderboard", async (req) => {
  const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 50), 200);
  const { rows } = await pool.query(
    `select ps.address, p.name, ps.games_played, ps.games_won, ps.total_volume, ps.total_earnings
     from player_stats ps left join players p on p.address = ps.address
     order by ps.total_volume desc, ps.games_played desc limit $1`,
    [limit],
  );
  return rows.map((r, i) => ({
    rank: i + 1,
    address: r.address,
    name: r.name,
    games: Number(r.games_played),
    wins: Number(r.games_won),
    volume: fmt(r.total_volume),
    earnings: fmt(r.total_earnings),
  }));
});

app.get("/api/stats", async () => {
  const m = await pool.query("select count(*)::int as games, coalesce(sum(stake),0) as vol from matches");
  const p = await pool.query("select count(*)::int as players from player_stats");
  const w = await pool.query("select coalesce(sum(prize_won),0) as paid from player_matches where outcome='win'");
  return {
    games: m.rows[0].games,
    players: p.rows[0].players,
    volume: fmt(m.rows[0].vol),
    prizesPaid: fmt(w.rows[0].paid),
  };
});

app.get<{ Params: { address: string } }>("/api/player/:address", async (req) => {
  const address = req.params.address.toLowerCase();
  const profile = await pool.query("select address, name, avatar_seed, bio from players where address=$1", [address]);
  const stats = await pool.query("select * from player_stats where address=$1", [address]);
  const recent = await pool.query(
    `select pm.arena_id, pm.outcome, pm.prize_won, m.stake, m.token, m.created_at
     from player_matches pm join matches m on m.arena_id = pm.arena_id
     where pm.player_address=$1 order by m.created_at desc nulls last limit 20`,
    [address],
  );
  const s = stats.rows[0];
  return {
    address,
    profile: profile.rows[0] ?? null,
    stats: s
      ? { games: Number(s.games_played), wins: Number(s.games_won), volume: fmt(s.total_volume), earnings: fmt(s.total_earnings) }
      : null,
    recent: recent.rows.map((r) => ({
      arenaId: String(r.arena_id),
      outcome: r.outcome,
      prize: fmt(r.prize_won),
      stake: fmt(r.stake),
      token: r.token,
      at: r.created_at,
    })),
  };
});

// Profile read stub (write/SIWE lands in Slice 5).
app.get<{ Params: { address: string } }>("/api/profile/:address", async (req, reply) => {
  const address = req.params.address.toLowerCase();
  const { rows } = await pool.query("select address, name, avatar_seed, bio from players where address = $1", [address]);
  if (!rows[0]) return reply.code(404).send({ error: "not_found", address });
  return rows[0];
});

async function migrate() {
  if (!connectionString) {
    app.log.warn("DATABASE_URL not set — skipping migration");
    return;
  }
  const sql = readFileSync(join(__dir, "..", "schema.sql"), "utf8");
  await pool.query(sql);
  app.log.info("schema migrated");
}

const port = Number(process.env.PORT || 8080);
try {
  await migrate();
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`bingochain-api listening on :${port}`);
  // Fire-and-forget: backfill + poll the chain in the background.
  void startIndexer(pool, app.log);
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
