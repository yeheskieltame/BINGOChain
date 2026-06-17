# BINGOChain Web

The BINGOChain web app — a **Next.js (App Router)** front end for the live
contract on **Celo mainnet**. Live at [bingochain.vercel.app](https://bingochain.vercel.app).
MiniPay-compatible (this project is mainnet-only).

## Stack

- Next.js 16 (App Router) + React 19
- wagmi + viem (Celo mainnet)
- Tailwind CSS — cinematic navy / neon / liquid-glass design system (Anton + Condiment + Geist Mono)
- MiniPay auto-connect (`hooks/useMiniPay.ts`)

## Pages

- `/` — cinematic landing (looping-video hero)
- `/arenas` — lobby: browse, filter, and search arenas, or create one
- `/arena/[id]` — live play: join, board, call numbers, claim BINGO, reveal, settle, withdraw
- `/create` — open a new arena (token + stake + seats)
- `/competition` — Cup: concurrent competitions in a grid, each with its own countdown and leaderboard
- `/profile` — display name, bio, photo upload, onchain stats, $LANCE buy/redeem, referrals
- `/how-to-play` — the rules

## Dev

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

`NEXT_PUBLIC_API_URL` points the app at a backend; it defaults to the deployed
Railway API, so the lobby and profiles work out of the box. Contract addresses
live in [`lib/bingo.ts`](./lib/bingo.ts) (sourced from `contracts/deployments/*.json`);
the ABI is generated into [`lib/abi.ts`](./lib/abi.ts).

## Assets

- `public/logo.png` — app logo (also `app/icon.png`, `app/apple-icon.png`, and `public/icon-{192,512}.png` for the favicon / PWA icon set)
- `public/space-bg.jpg` — the cosmic backdrop still used across in-app pages
