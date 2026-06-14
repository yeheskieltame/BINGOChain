# Upgrade runbook — Celo Mainnet

The mainnet proxy owner is a **Safe multisig (threshold 2)**, so upgrades and
admin actions are executed through the Safe.

- Proxy (never changes): `0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1`
- Owner Safe: `0xe9Fc48f315fD4E989637fAcC29AaF2717E19f7F0`

History: v1.0.0 → v1.1.0 (clean source, executed) live impl `0x1b28f5F57F0e9d879b66C3e704Ee2203F1406181`.

## Pending: v1.2.0 multi-token + enable tokens

New implementation (Celoscan-verified): [`0xe0d154f708742005Ee9279A3357A1f26267ccB6c`](https://celoscan.io/address/0xe0d154f708742005Ee9279A3357A1f26267ccB6c#code).
Adds ERC20 settlement (CELO, cUSD, USDC, USDT). Storage is append-only — upgrade-safe.

Execute as **one Safe batch** (Transaction Builder → 5 transactions, all **To** the
proxy, **value 0**). MultiSend runs them in order, so the upgrade lands before the
`allowToken` calls hit the new implementation:

| # | Action | Raw calldata |
|---|--------|--------------|
| 1 | `upgradeToAndCall` → v1.2.0 | `0x4f1ef286000000000000000000000000e0d154f708742005ee9279a3357a1f26267ccb6c00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000000` |
| 2 | `allowToken(CELO, 1e18)` | `0xa147c6c6000000000000000000000000471ece3750da237f93b8e339c536989b8978a4380000000000000000000000000000000000000000000000000de0b6b3a7640000` |
| 3 | `allowToken(cUSD, 1e18)` | `0xa147c6c6000000000000000000000000765de816845861e75a25fca122bb6898b8b1282a0000000000000000000000000000000000000000000000000de0b6b3a7640000` |
| 4 | `allowToken(USDC, 1e6)` | `0xa147c6c6000000000000000000000000ceba9300f2b948710d2653dd7b07f33a8b32118c00000000000000000000000000000000000000000000000000000000000f4240` |
| 5 | `allowToken(USDT, 1e6)` | `0xa147c6c600000000000000000000000048065fbbe25f71c9282ddf5e1cd6d6a887483d5e00000000000000000000000000000000000000000000000000000000000f4240` |

Tokens (Celo mainnet): CELO `0x471EcE37…a438`, cUSD `0x765DE816…282a`, USDC
`0xcebA9300…118C`, USDT `0x48065fbB…3D5e`. Min stake = 1 unit each.

After the batch: `version()` = `1.2.0`, `isTokenAllowed(token)` = true for all four.

## General upgrade procedure

1. `cd contracts && forge test` — full suite green.
2. Storage must be append-only (never reorder/retype `CoreStorage` or `Arena`).
3. `forge create src/BingoChain.sol:BingoChain --rpc-url $CELO_MAINNET_RPC --private-key $DEPLOYER_PRIVATE_KEY --broadcast --verify` (add `--gas-price 220000000000` — forge over-estimates).
4. Submit `upgradeToAndCall(newImpl, "0x")` to the proxy via the Safe; collect signatures; execute.
