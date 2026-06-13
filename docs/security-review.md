# Security review — BingoChain

Pre-mainnet review of the BingoChain contract family. The contract custodies player
stakes, so the bar is high. This complements the test suite (86 tests: unit, fuzz,
integration scenarios, and money-conservation invariants over 16,384 random
call-sequences) and the [live Sepolia run](./live-test-sepolia.md).

## Tooling

- **Slither 0.11.4** (`slither . --config-file slither.config.json`) — static analysis.
- **forge test** — 86 tests, incl. invariants `balance == netflow` and `Σearnings ≤ balance`.
- **forge fmt / solhint** — style + custom-error enforcement.

## Threat model & key properties

| Property | Mechanism |
|----------|-----------|
| Boards can't be changed mid-game | commit–reveal (`keccak256(abi.encode(board, salt))`) |
| Winner can't be faked | deterministic replay of the recorded call sequence; `claimBingo` is non-binding |
| No CELO minted/burned | invariant `balance == totalIn − totalOut` (16k fuzzed calls) |
| Payouts always honorable | invariant `Σearnings ≤ balance`; pull pattern |
| No stranded funds | `cancelArena` (unfilled lobby), treasury-sweep on no-reveal |
| Reentrancy | `nonReentrant` on all mutating paths; checks-effects-interactions in `withdraw` |
| Upgrade abuse | UUPS `_authorizeUpgrade` gated to the owner (Safe multisig on mainnet) |
| Privileged-key abuse | `rescueERC20` can't touch native CELO; fee bounded by `MAX_FEE_BPS` |

## Slither triage

Changes made in response:
- **reentrancy-events (`rescueERC20`)** → added `nonReentrant` + moved the event before the transfer. Resolved.
- **cyclomatic-complexity (`settle` = 18)** → extracted `_resolveWinners`; `settle` is now shallow and the winner logic is isolated and view-only. Resolved.

Remaining findings reviewed and **accepted as safe / by-design**:

| Detector | Where | Rationale |
|----------|-------|-----------|
| `timestamp` | reveal/join windows | Windows are 1 day; ~15s miner skew is negligible. Intentional. |
| `low-level-calls` | `withdraw` | `call{value:}` is the correct CELO-send pattern; guarded by `nonReentrant` + balance zeroed first. |
| `assembly` | `_s()` | EIP-7201 namespaced-storage accessor — required, standard. |
| `divide-before-multiply` | `settle` payout | `share = pool/n; remainder = pool − share*n` computes exact dust on purpose; conservation proven by invariants. |
| `uninitialized-local` | counters/arrays | Solidity zero-initializes; defaults are intended (counts start at 0). |
| `too-many-digits` | `LineLib` masks | Bitmasks are zero-padded to a fixed width for readability/auditability. |
| `unindexed-event-address` | OZ `Paused`/`AdminChanged` | Library events, out of scope. |

## Conclusion

No vulnerabilities found. All accounting is conserved under fuzzing and verified
live on Sepolia. Outstanding items before a mainnet deploy are **process**, not
code: owner must be a Safe multisig, and a final independent audit is recommended
given the contract holds funds.
