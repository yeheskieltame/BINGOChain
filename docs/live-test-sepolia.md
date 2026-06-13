# Live test — Celo Sepolia

Full game rounds played end-to-end against the deployed proxy
[`0xa21424B1F8c08e3d437942110081ef9F1b7589A6`](https://sepolia.celoscan.io/address/0xa21424B1F8c08e3d437942110081ef9F1b7589A6)
on Celo Sepolia (chain 11142220), via [`scripts/play-round.mjs`](../scripts/play-round.mjs).

Each round runs the complete lifecycle on-chain:
`createArena → commitBoard ×2 → callNumber × N → claimBingo → revealBoard ×2 → settle → withdraw`.

## Rounds

| Arena | Scenario | Boards | Calls | Outcome (on-chain) |
|------:|----------|--------|------:|--------------------|
| 2 | winner | ordered vs loser | 21 | player1 wins `1.98`, fee `0.02` |
| 3 | winner | ordered vs loser | 21 | player1 wins `1.98`, fee `0.02` ([settle](https://sepolia.celoscan.io/tx/0x7a336a9e5db4f317a811d82813a9a24a0456bfd2d1b365dcfd009e3325b28008)) |
| 4 | tie | ordered vs ordered | 21 | split `0.99` / `0.99`, fee `0.02` |
| 5 | no-BINGO fallback | ordered vs loser | 5 | player1 (most lines) wins `1.98`, fee `0.02` |

## Reconciliation (read live after replicas synced)

- 4 arenas all in state **Settled**.
- `treasury` earnings = **0.08 CELO** = 4 × 1% of a 2-CELO pot. ✔
- All player winnings withdrawn (`earningsOf` p1 = p2 = 0). ✔
- Contract balance = **0.08 CELO** = exactly the unwithdrawn treasury fees; no
  player stake stranded, no CELO created. ✔

**Result: on-chain behavior matches the local suite exactly. No contract bugs found.**

## Note on the harness (not a contract issue)

forno load-balances RPC replicas, so an `earningsOf` read issued immediately after
a `settle` write can hit a lagging replica and momentarily show pre-settle values.
This only affected the script's printed line; `withdraw()` pulls the full actual
balance regardless, so payouts were always correct. The harness now waits briefly
before the display read and always attempts `withdraw` (catching `NothingToWithdraw`).
