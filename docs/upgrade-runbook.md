# Upgrade runbook — Celo Mainnet

The mainnet proxy owner is a **Safe multisig (threshold 2)**, so upgrades are
executed through the Safe, not from a single key.

## Pending: comment-cleanup upgrade (v1.1.0, clean source)

A new implementation with identical runtime bytecode (only comments/source tidied)
is deployed and Celoscan-verified:

| | |
|---|---|
| Proxy (unchanged) | `0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1` |
| New implementation | [`0x1b28f5F57F0e9d879b66C3e704Ee2203F1406181`](https://celoscan.io/address/0x1b28f5F57F0e9d879b66C3e704Ee2203F1406181#code) |
| Current implementation | `0x377490a98b99Ff644B9e2878f7791Bc1AA5a5C3E` |

Runtime bytecode is byte-identical to the current implementation except the
trailing metadata hash — behavior is provably unchanged (86 tests + invariants pass).

### Execute via Safe (https://app.safe.global)

New Transaction → Transaction Builder (or Contract interaction):

- **To:** `0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1` (the proxy)
- **Value:** 0
- **Method:** `upgradeToAndCall(address implementation, bytes data)`
  - `implementation` = `0x1b28f5F57F0e9d879b66C3e704Ee2203F1406181`
  - `data` = `0x` (empty — no re-initialization)

Or paste the raw calldata directly:

```
0x4f1ef2860000000000000000000000001b28f5f57f0e9d879b66c3e704ee2203f140618100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000
```

Collect the second signature and execute. Afterwards `version()` still returns
`1.1.0` and Celoscan shows the clean source for the proxy's implementation.

## General upgrade procedure

1. `cd contracts && forge test` — full suite green.
2. Confirm storage layout is append-only (never reorder/retype `CoreStorage`).
3. Deploy the new impl: `forge create src/BingoChain.sol:BingoChain --rpc-url $CELO_MAINNET_RPC --private-key $DEPLOYER_PRIVATE_KEY --broadcast --verify`.
4. Submit `upgradeToAndCall(newImpl, data)` to the proxy via the Safe; collect signatures; execute.
