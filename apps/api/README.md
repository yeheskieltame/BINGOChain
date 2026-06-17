# bingochain-api

Backend for BINGOChain — player profiles (name, photo, bio), stats, Cup
competitions, referrals, and leaderboards. On-chain stays the source of truth;
this service stores off-chain identity and an indexed read-cache of game data,
kept current by a viem indexer.

- **Runtime:** Node 20 + Fastify 5 (ESM, run via `tsx` — no build step).
- **DB:** Postgres (schema in `schema.sql`, migrated idempotently on boot).

## Endpoints

| Method | Path | Notes |
| ------ | ---- | ----- |
| GET | `/api/health` | `{ ok, db, ts }` — Railway healthcheck |
| GET | `/api/stats` | global games / players / volume / prizes paid |
| GET | `/api/leaderboard?limit=` | top players by total volume |
| GET | `/api/arenas?limit=` | recent arena ids (newest first) |
| GET | `/api/arena/:id` | match detail: players, winners, revealed boards |
| GET | `/api/player/:address` | profile + stats + recent games |
| GET | `/api/profile/:address` | profile row (name, avatar_seed, avatar_url, bio) |
| GET | `/api/profiles?addresses=` | batch profile lookup (names + avatars) |
| GET | `/api/auth/nonce/:address` | SIWE nonce for a profile write |
| PUT | `/api/profile/:address` | SIWE-gated write: name, photo (avatar_url), bio |
| GET | `/api/competitions` | Cup events with computed status (upcoming / live / past) |
| GET | `/api/competitions/:id/leaderboard` | leaderboard scoped to one event's window |
| GET | `/api/referral/:address` · `/api/referrals/leaderboard` | referral stats |
| POST | `/api/referral` | SIWE-gated: record who invited the signer |

Profile **photos** are stored as `avatar_url` — either an https image URL or a
small inline data-URI (capped server-side). **Cup** supports several concurrent
competitions, each scoping a different time window, so a daily, weekend, and
weekly cup can run at once with separate leaderboards.

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

Healthcheck path is `/api/health` (see `railway.json`). The schema (including the
`avatar_url` column and the Cup seed) migrates idempotently on every boot.
