import { createPublicClient, http, parseAbiItem } from "viem";
import { celo } from "viem/chains";
import type { Pool } from "pg";

// Indexes BINGOChain on-chain events into Postgres. Backfills from the proxy's
// creation block in chunks (forno rejects wide eth_getLogs ranges), then polls
// for new blocks. Cursor persisted in indexer_state so restarts resume cleanly.

const RPC = process.env.CELO_RPC || "https://forno.celo.org";
const PROXY = (process.env.BINGO_ADDRESS || "0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1") as `0x${string}`;
const START_BLOCK = BigInt(process.env.INDEX_START_BLOCK || "69517055");
const CHUNK = BigInt(process.env.INDEX_CHUNK || "9000");
const POLL_MS = Number(process.env.INDEX_POLL_MS || "20000");
const CURSOR_ID = "bingo";

const EVENTS = [
  parseAbiItem(
    "event ArenaCreated(uint256 indexed arenaId, address indexed creator, address indexed token, uint96 stake, uint8 maxPlayers)",
  ),
  parseAbiItem("event PlayerJoined(uint256 indexed arenaId, address indexed player, uint8 joinedCount)"),
  parseAbiItem("event ArenaSettled(uint256 indexed arenaId, uint256 prizePool, uint256 fee, uint8 winnerCount)"),
  parseAbiItem("event WinnerPaid(uint256 indexed arenaId, address indexed winner, uint256 amount)"),
  parseAbiItem("event ArenaCancelled(uint256 indexed arenaId, uint8 refunded)"),
];

const client = createPublicClient({ chain: celo, transport: http(RPC) });

type Logger = { info: (o: unknown, m?: string) => void; error: (o: unknown, m?: string) => void; warn: (o: unknown, m?: string) => void };

export async function startIndexer(pool: Pool, log: Logger) {
  if (!process.env.DATABASE_URL) {
    log.warn("indexer: DATABASE_URL not set — disabled");
    return;
  }

  const tsCache = new Map<string, string>();
  const blockTs = async (bn: bigint): Promise<string> => {
    const k = bn.toString();
    const hit = tsCache.get(k);
    if (hit) return hit;
    // forno throttles bursts of getBlock — retry transient failures.
    for (let attempt = 0; ; attempt++) {
      try {
        const b = await client.getBlock({ blockNumber: bn });
        const iso = new Date(Number(b.timestamp) * 1000).toISOString();
        tsCache.set(k, iso);
        return iso;
      } catch (e) {
        if (attempt >= 3) throw e;
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
      }
    }
  };

  async function getCursor(): Promise<bigint> {
    const r = await pool.query("select last_block from indexer_state where id=$1", [CURSOR_ID]);
    if (r.rows[0]) return BigInt(r.rows[0].last_block);
    await pool.query("insert into indexer_state(id,last_block) values($1,$2) on conflict (id) do nothing", [
      CURSOR_ID,
      (START_BLOCK - 1n).toString(),
    ]);
    return START_BLOCK - 1n;
  }
  const setCursor = (bn: bigint) =>
    pool.query("update indexer_state set last_block=$2, updated_at=now() where id=$1", [CURSOR_ID, bn.toString()]);

  async function processRange(from: bigint, to: bigint): Promise<number> {
    const logs = await client.getLogs({ address: PROXY, events: EVENTS, fromBlock: from, toBlock: to });
    for (const lg of logs) {
      const name = (lg as { eventName: string }).eventName;
      const a = (lg as { args: Record<string, bigint | string | number> }).args;
      const ts = await blockTs(lg.blockNumber!);
      if (name === "ArenaCreated") {
        await pool.query(
          `insert into matches(arena_id, token, stake, created_at) values($1,$2,$3,$4)
           on conflict (arena_id) do update set token=excluded.token, stake=excluded.stake, created_at=excluded.created_at`,
          [String(a.arenaId), String(a.token).toLowerCase(), String(a.stake), ts],
        );
      } else if (name === "PlayerJoined") {
        await pool.query("insert into players(address) values($1) on conflict (address) do nothing", [
          String(a.player).toLowerCase(),
        ]);
        await pool.query(
          "insert into player_matches(arena_id, player_address) values($1,$2) on conflict (arena_id, player_address) do nothing",
          [String(a.arenaId), String(a.player).toLowerCase()],
        );
      } else if (name === "ArenaSettled") {
        await pool.query("update matches set prize_pool=$2, fee=$3, winner_count=$4, settled_at=$5 where arena_id=$1", [
          String(a.arenaId),
          String(a.prizePool),
          String(a.fee),
          Number(a.winnerCount),
          ts,
        ]);
        await pool.query("update player_matches set outcome='loss' where arena_id=$1 and outcome is null", [String(a.arenaId)]);
      } else if (name === "WinnerPaid") {
        await pool.query("update player_matches set outcome='win', prize_won=$3 where arena_id=$1 and player_address=$2", [
          String(a.arenaId),
          String(a.winner).toLowerCase(),
          String(a.amount),
        ]);
      } else if (name === "ArenaCancelled") {
        await pool.query("update matches set settled_at=$2, winner_count=0 where arena_id=$1", [String(a.arenaId), ts]);
        await pool.query("update player_matches set outcome='cancelled' where arena_id=$1 and outcome is null", [String(a.arenaId)]);
      }
    }
    return logs.length;
  }

  // Recompute denormalized stats from the raw tables — idempotent, cheap at this scale.
  const recomputeStats = () =>
    pool.query(`
      insert into player_stats(address, games_played, games_won, total_volume, total_earnings, last_game_at, updated_at)
      select pm.player_address, count(*)::int, (count(*) filter (where pm.outcome='win'))::int,
             coalesce(sum(m.stake),0), coalesce(sum(pm.prize_won),0), max(m.created_at), now()
      from player_matches pm join matches m on m.arena_id = pm.arena_id
      group by pm.player_address
      on conflict (address) do update set
        games_played=excluded.games_played, games_won=excluded.games_won,
        total_volume=excluded.total_volume, total_earnings=excluded.total_earnings,
        last_game_at=excluded.last_game_at, updated_at=now()
    `);

  async function tick() {
    const head = await client.getBlockNumber();
    let cursor = await getCursor();
    while (cursor < head) {
      const from = cursor + 1n;
      const to = from + CHUNK - 1n > head ? head : from + CHUNK - 1n;
      let n = 0;
      try {
        n = await processRange(from, to);
      } catch (e) {
        // A transient RPC failure mid-backfill: stop here and resume from the
        // saved cursor next tick. Stats already reflect prior chunks.
        log.error(e, `indexer: chunk ${from}-${to} failed, retrying next tick`);
        break;
      }
      cursor = to;
      await setCursor(cursor);
      // Recompute per chunk (cheap at this scale) so stats populate
      // progressively and survive a partial backfill.
      if (n > 0) {
        await recomputeStats();
        log.info({ to: to.toString(), head: head.toString() }, "indexer: chunk indexed");
      }
    }
  }

  log.info({ start: START_BLOCK.toString() }, "indexer: starting backfill");
  // Recompute from whatever is already indexed so stats are correct on boot
  // even before this run processes any new events.
  await recomputeStats().catch((e) => log.error(e, "indexer: initial recompute failed"));
  await tick().catch((e) => log.error(e, "indexer backfill error"));
  setInterval(() => void tick().catch((e) => log.error(e, "indexer tick error")), POLL_MS);
}
