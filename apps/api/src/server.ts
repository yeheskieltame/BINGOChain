import Fastify from "fastify";
import cors from "@fastify/cors";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

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

// Placeholder — full profile read/write (SIWE-gated) lands in Slice 5.
app.get<{ Params: { address: string } }>("/api/profile/:address", async (req, reply) => {
  const address = req.params.address.toLowerCase();
  const { rows } = await pool.query(
    "select address, name, avatar_seed, bio from players where address = $1",
    [address],
  );
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
} catch (e) {
  app.log.error(e);
  process.exit(1);
}
