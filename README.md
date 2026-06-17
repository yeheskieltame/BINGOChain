<p align="center">
  <img src="apps/web/public/logo.png" alt="BINGOChain logo" width="128" height="128" />
</p>

<h1 align="center">BINGOChain</h1>

**Strategic onchain bingo on Celo. Boards are sealed before play, every called number is recorded onchain, and the full game is revealed at the end so cheating is mathematically impossible.**

Live app: [bingochain.vercel.app](https://bingochain.vercel.app) · staked in [$LANCE](https://claudelance.xyz)

> A PvP arena where players design their own 5×5 board, lock it in a smart contract, and race to BINGO. No trusted server, no hidden randomness, no way to fake a win.

## Overview

BINGOChain turns bingo into a fully verifiable onchain strategy game. Each player builds a private 5×5 board (numbers 1–25, no duplicates) and commits it to the contract before the round starts. Players then take turns calling numbers. Every call marks that number on every board and is permanently recorded onchain. The first player to complete 5 lines wins the pot.

Because boards stay secret during play but are revealed and verified at the end, the game is transparent and tamper-proof without trusting anyone.

## How it works

1. **Create arena** — A creator opens an arena and sets the entry stake (minimum 1 CELO per player, higher if they choose) and player count (2–6).
2. **Commit** — Each player joins, deposits the stake, and submits `hash(board + salt)`. The board is locked (the hash cannot change) but stays secret (only the hash is onchain).
3. **Play** — Players take turns calling a number (1–25, each number once). Every call is recorded onchain and marks that cell on all boards.
4. **Claim** — When a player believes they have 5 lines, they send a `BINGO` transaction, which moves the game into the reveal phase.
5. **Reveal & verify** — Every player reveals `board + salt`. The contract checks each hash matches the committed one, then replays the exact sequence of called numbers against the revealed boards to verify the winning claim.
6. **Settle** — The contract pays out: 1% protocol fee, the rest to the winner. Any unused gas reserve rolls into the winner's payout.

## Why it's fair

**No onchain randomness needed.** Numbers are chosen by players in turn, not drawn at random, so BINGOChain avoids VRF/oracle complexity entirely. The only variables are board layout (secret) and which numbers get called (public).

**Commit–reveal seals the boards.** During play only the hash is visible, so no one can see or alter an opponent's board. At reveal, a mismatched hash or refusal to reveal is provably cheating and is penalized by stake slashing.

**Winners are verified, not asserted.** Because boards are hidden during play, the contract determines the winner in the reveal phase by replaying the recorded call sequence against the revealed boards. A false BINGO claim fails verification and is penalized. The result is fully deterministic and auditable on Celoscan.

## Economics

**Entry stake:** minimum 1 CELO per player, set by the arena creator.

**Gasless play:** transactions during the round are sponsored from a small gas reserve carved out of the pot, so players sign without holding CELO for gas. The reserve is denominated in CELO, avoiding the fee-currency surcharge that non-CELO gas would add.

**Payout:**
```
prizePool = totalStake − gasReserve − 1% protocol fee
unused gasReserve → added to the winner's payout
```

**Ties:** if two or more players reach BINGO at the *same call index*, they are co-winners and split the prize equally. Completing 5 lines at a later index loses.

**No-BINGO fallback:** if all 25 numbers are called and no one has 5 lines, the player(s) with the most completed lines win (split if tied). The pot is never stranded.

**Timeout / abandonment:** a player who fails to reveal within the reveal window forfeits automatically; the prize goes to the verified winner. This keeps a game from stalling forever.

## Gas model

The maximum number of called-number transactions is fixed: with 25 numbers and no duplicates, a game can never exceed **25 calls**. This makes the worst-case transaction count deterministic.

| Phase | Gas/tx (est.) | Count |
|-------|---------------|-------|
| commitBoard | ~70k | N players |
| callNumber | ~55k | 25 (fixed) |
| claimBingo | ~50k | 1 |
| revealBoard | ~90k | N players |
| settle | ~80k + ~25k/winner | 1 |

Worst-case total gas cost at ~25 Gwei with a 1.5× safety margin:

| Players | Worst-case cost | Gas per player |
|---------|-----------------|----------------|
| 2 | ~0.070 CELO | ~0.035 |
| 4 | ~0.086 CELO | ~0.021 |
| 6 | ~0.098 CELO | ~0.016 |

**Key property:** the dominant cost is the 25 fixed `callNumber` transactions, which do not depend on player count. So as more players join, the per-player gas share *decreases* — the shared cost is split across more people. A flat gas reserve of ~0.1–0.15 CELO per arena covers the worst case regardless of player count, leaving 90%+ of stakes for the prize pool.

> Per-function gas figures above are conservative estimates. Final values are locked from `forge test --gas-report` and the gas reserve is set from the measured worst case. `callNumber` (called up to 25×) is the hot path and stores called numbers as a `uint32` bitmask (25 bits in a single slot) to minimize cost.

## State machine

```
Created → Committed → Playing → Revealing → Settled
```

- **Created** — arena open, parameters set, accepting players
- **Committed** — all players joined, stakes locked, board hashes submitted
- **Playing** — turn-based number calling, each call recorded onchain
- **Revealing** — BINGO claimed or 25 calls reached; players reveal boards for verification
- **Settled** — winner verified, payout and protocol fee distributed

## Tech stack

- **Contracts:** Solidity 0.8.24, Foundry, OpenZeppelin v5 **upgradeable** — UUPS proxy (EIP-1822), `Ownable2StepUpgradeable`, `PausableUpgradeable`, EIP-7201 namespaced storage
- **Chain:** Celo Mainnet — mainnet-only by design (sub-cent fees make per-call micro-transactions economical; local testing uses an anvil mainnet fork)
- **Frontend:** Next.js 16 (App Router) + React 19, wagmi/viem, Tailwind — live at [bingochain.vercel.app](https://bingochain.vercel.app), MiniPay-compatible
- **Backend:** Fastify 5 + Postgres (profiles, avatars, stats, Cup competitions, referrals) plus a viem indexer; deployed on Railway
- **Settlement tokens:** $LANCE (default), CELO, cUSD, USDC, USDT

## The app

Beyond the contract, BINGOChain ships a full web app at [bingochain.vercel.app](https://bingochain.vercel.app):

- **Arena lobby** — browse open and live arenas, filter by state, search by id or token, and create your own.
- **Live play** — join an arena, get a sealed 5×5 board, call numbers in turn, claim BINGO, reveal, and settle, all onchain.
- **Cup** — several competitions run concurrently (Daily Sprint, Weekend Showdown, Weekly Volume Cup), each with its own time window, live countdown, and leaderboard, shown together in a grid.
- **Profiles** — set a display name and bio, upload a profile photo, and see your onchain stats, recent games, and achievements.
- **$LANCE panel** — buy $LANCE with CELO at NAV or redeem it back, then stake it to play.
- **Referrals** — invite players and earn $LANCE when they qualify.
- **Cinematic UI** — a space-themed cosmic backdrop, Anton display type with neon accents, and liquid-glass surfaces across every page.

BINGOChain is built and shipped on [Claudelance](https://claudelance.xyz), the onchain marketplace where AI agents take bounties for real rewards.

## Repository layout

A monorepo keeps the smart contracts and the app cleanly separated:

```
BINGOChain/
├── contracts/        # Foundry project — Solidity contracts, tests, deploy scripts
│   ├── src/          # BingoChain implementation, proxy, storage, types
│   ├── test/         # unit / fuzz / invariant suites
│   └── lib/          # vendored deps (OpenZeppelin, forge-std)
├── apps/
│   └── web/          # MiniPay mini app (frontend) — planned
├── README.md · LICENSE · SECURITY.md · CONTRIBUTING.md
└── .github/          # CI (build · fmt · test · Slither)
```

All Foundry commands run inside `contracts/` (e.g. `cd contracts && forge test`).

## Architecture

BINGOChain ships as a **UUPS-upgradeable** contract so the game engine can evolve
(new game modes, fixes, gas tuning) without migrating escrowed arenas to a new
address.

- **Proxy pattern:** ERC-1967 proxy (`BingoChainProxy`) → `BingoChain` implementation. Upgrades go through `upgradeToAndCall`; `_authorizeUpgrade` is gated to the owner.
- **Upgrade authority:** the owner is a **Safe multisig** (threshold 2). Because the contract custodies player stakes, this is a deliberate, documented trust trade-off — see [`SECURITY.md`](./SECURITY.md).
- **Storage safety:** all state lives under an **EIP-7201 namespace** (`bingochain.core.v1`), so upgrades append fields without risking storage collisions. Existing fields are never reordered or retyped.
- **Reentrancy:** OZ v5 dropped `ReentrancyGuardUpgradeable`; the guard flag lives in namespaced storage and is enforced by a local `nonReentrant` modifier.

> This is an intentional change from an earlier immutable design: upgradeability is
> gained at the cost of a trusted upgrade key, mitigated by the Safe multisig.

## Celo & MiniPay fit

BINGOChain is built around what Celo does best. Sub-cent fees make a game with 30+ onchain transactions per round economically viable, which is not feasible on most chains. MiniPay's phone-number wallets remove onboarding friction, and the arena/PvP model maps directly to MiniPay's mobile-first audience. Every game produces real, verifiable onchain activity backed by actual gameplay.

## Status & roadmap

- [x] Repo scaffold: Foundry + OZ v5 upgradeable, CI (build/fmt/test/Slither), UUPS proxy skeleton
- [x] Core contract: commit–reveal, turn engine, bitmask call tracking
- [x] Reveal verification: hash check + call-sequence replay (`settle`)
- [x] Reclaim (`cancelArena`) + admin (fee/treasury/pause/rescue) + security review (Slither, 0 vuln)
- [x] **Live on Celo Mainnet** (verified) — proxy [`0x8bE7c07C…32f1`](https://celoscan.io/address/0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1#code), owner = Safe multisig
- [x] Foundry unit + fuzz + invariant suite (86 tests; 16k-call money-conservation invariants)
- [ ] `estimateGasReserve(numPlayers)` view + worst-case lock from gas report
- [ ] Gasless relayer (reserve-reimbursed) — Phase 2
- [ ] MiniPay frontend (create arena, join, play, reveal)

## License

MIT