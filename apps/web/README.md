# BINGOChain Web (MiniPay mini app)

A **MiniPay-compatible** Next.js mini app for BINGOChain — connects to the live
contract on Celo (mainnet by default, Sepolia for dev).

## Stack

- Next.js 15 (App Router) + React 19
- wagmi + viem (Celo + Celo Sepolia)
- Tailwind CSS
- MiniPay auto-connect (`hooks/useMiniPay.ts`)

## Dev

```bash
pnpm install
pnpm dev          # http://localhost:3000

# target Sepolia instead of mainnet:
NEXT_PUBLIC_CHAIN_ID=11142220 pnpm dev
```

Contract addresses live in [`lib/bingo.ts`](./lib/bingo.ts) (sourced from
`contracts/deployments/*.json`); the ABI is generated from the Foundry build into
[`lib/abi.ts`](./lib/abi.ts).

## Status

- [x] Scaffold + wallet connect + MiniPay detection + live contract read
- [ ] Create arena flow
- [ ] Join + board picker (commit)
- [ ] Play (call numbers) + claim
- [ ] Reveal + settle + withdraw
