# bingochain-api

Backend for BINGOChain — player profiles, stats, and (later) live leaderboards.
On-chain stays the source of truth; this service stores off-chain identity
(names/avatars/bio) and an indexed read-cache of game data.

- **Runtime:** Node 20 + Fastify 5 (ESM, run via `tsx` — no build step).
- **DB:** Postgres (schema in `schema.sql`, migrated idempotently on boot).

## Endpoints

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/api/health` | `{ ok, db: "up"\|"down", ts }` — Railway healthcheck |
| GET | `/api/profile/:address` | profile row or 404 (write/SIWE in Slice 5) |

## Local dev

```bash
npm install
DATABASE_URL=postgres://localhost:5432/bingo npm run dev   # or omit DATABASE_URL to boot without a DB
```

## Deploy (Railway)

```bash
railway init --name bingochain-api          # create + link project
railway add --database postgres             # provision Postgres
railway up --service bingochain-api         # build (Dockerfile) + deploy
railway variables --service bingochain-api --set 'DATABASE_URL=${{Postgres.DATABASE_URL}}'
railway domain --service bingochain-api     # public URL
```

Healthcheck path is `/api/health` (see `railway.json`).
