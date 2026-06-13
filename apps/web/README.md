# BINGOChain Web (MiniPay mini app)

> Placeholder — the frontend is not built yet. This directory reserves the spot
> in the monorepo so contracts and UI stay cleanly separated.

Planned: a **MiniPay-compatible** mini app (phone-number identity, no wallet
setup) for the full arena flow — create, join, commit board, play, reveal —
against the BingoChain contract on Celo.

- **Stack (planned):** Next.js (App Router), viem + wagmi, MiniPay detection.
- **Targets:** the BingoChain proxy on Celo Sepolia first, then mainnet.
- Contract ABIs are consumed from [`../../contracts`](../../contracts).

See the repository root [`README.md`](../../README.md) for the overall design.
