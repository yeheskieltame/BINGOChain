import Fastify from "fastify";
import cors from "@fastify/cors";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { formatEther } from "viem";
import pg from "pg";
import { startIndexer } from "./indexer.ts";
import { registerProfileRoutes } from "./profiles.ts";

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

// Recent arena ids (newest first) from the index — the lobby multicalls
// getArena for live state, avoiding a browser eth_getLogs (forno blocks it).
app.get("/api/arenas", async (req) => {
  const limit = Math.min(Number((req.query as { limit?: string }).limit ?? 60), 200);
  const { rows } = await pool.query("select arena_id from matches order by arena_id desc limit $1", [limit]);
  return rows.map((r) => String(r.arena_id));
});

// Full arena detail — match + per-player outcome/prize + revealed boards.
app.get<{ Params: { id: string } }>("/api/arena/:id", async (req, reply) => {
  const id = req.params.id;
  if (!/^\d+$/.test(id)) return reply.code(400).send({ error: "bad_id" });
  const m = await pool.query("select * from matches where arena_id=$1", [id]);
  if (!m.rows[0]) return reply.code(404).send({ error: "not_found", id });
  const pm = await pool.query(
    `select pm.player_address, pm.outcome, pm.prize_won, p.name
     from player_matches pm left join players p on p.address = pm.player_address
     where pm.arena_id=$1`,
    [id],
  );
  const rb = await pool.query("select player_address, board from revealed_boards where arena_id=$1", [id]);
  const row = m.rows[0];
  return {
    arenaId: id,
    match: {
      token: row.token,
      stake: fmt(row.stake),
      prizePool: fmt(row.prize_pool),
      fee: fmt(row.fee),
      winnerCount: row.winner_count,
      createdAt: row.created_at,
      settledAt: row.settled_at,
    },
    players: pm.rows.map((r) => ({ address: r.player_address, name: r.name, outcome: r.outcome, prize: fmt(r.prize_won) })),
    winners: pm.rows
      .filter((r) => r.outcome === "win")
      .map((r) => ({ address: r.player_address, name: r.name, prize: fmt(r.prize_won) })),
    boards: rb.rows.map((r) => ({ player: r.player_address, board: r.board as number[] })),
  };
});

// Profile read stub (write/SIWE lands in Slice 5).
app.get<{ Params: { address: string } }>("/api/profile/:address", async (req, reply) => {
  const address = req.params.address.toLowerCase();
  const { rows } = await pool.query("select address, name, avatar_seed, bio from players where address = $1", [address]);
  if (!rows[0]) return reply.code(404).send({ error: "not_found", address });
  return rows[0];
});

registerProfileRoutes(app, pool);

// Seed the Cup events: one ongoing (live) + one ended (past). Idempotent.
async function seedCompetitions() {
  if (!connectionString) return;
  await pool.query(`
    insert into competitions(id, title, starts_at, ends_at, prize_per_winner, top_n, token) values
      ('weekly-1', 'Weekly Volume Cup', now() - interval '2 days', now() + interval '5 days', 20, 10, '$LANCE'),
      ('cup-1', 'Volume Cup #1', timestamptz '2026-06-16 00:00:00+00', timestamptz '2026-06-16 12:00:00+00', 20, 10, '$LANCE')
    on conflict (id) do nothing
  `);
}

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
  await seedCompetitions().catch((e) => app.log.error(e, "seed competitions failed"));
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`bingochain-api listening on :${port}`);
  // Fire-and-forget: backfill + poll the chain in the background.
  void startIndexer(pool, app.log);
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
