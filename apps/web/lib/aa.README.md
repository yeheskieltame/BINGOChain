# Gasless play via account abstraction (ERC-4337)

`lib/aa.ts` is the foundation for **industry-standard gasless, popup-free gameplay**:
the player is a **ZeroDev Kernel smart account** on Celo, the connected wallet is its
**owner**, and a **session key** scoped to BingoChain's gameplay functions auto-signs
every move while a **paymaster sponsors the gas**. The game contract is unchanged
(the smart account is `msg.sender`).

Researched + chosen because: ERC-4337 + session keys + paymaster is the standard for
onchain games; Celo mainnet is supported by Pimlico's bundler/paymaster (which ZeroDev
routes to); and it needs zero contract changes (unlike EIP-2771 meta-tx).

## What you must set up (one-time, unblocks everything)

1. Create a project at **dashboard.zerodev.app** and add **Celo Mainnet (chain 42220)**.
2. Copy the project's **ZeroDev RPC URL** (a combined bundler + paymaster endpoint).
3. In the dashboard, create a **Gas Sponsorship Policy** and fund it. Scope it to the
   BingoChain proxy `0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1` to cap spend.
4. Set the env var (Vercel project env + local `.env.local`):
   ```
   NEXT_PUBLIC_ZERODEV_RPC=https://rpc.zerodev.app/api/v3/<projectId>/chain/42220
   ```

`aaConfigured()` returns false until this is set, so the UI can hide smooth play until ready.

## How the pieces fit (lib/aa.ts)

- `ownerKernel(owner)` - the player's smart account + a paymaster-sponsored client.
- `approveGameSession(owner, sessionKeyAddress)` - owner signs once; returns a serialized
  approval. The session key may only call `commitBoard / callNumber / claimBingo /
  revealBoard` on BingoChain, with `valueLimit: 0` (can never move funds).
- `gameSessionClient(approval, sessionSigner)` - rebuilds the session account and returns
  a client that auto-signs scoped moves, gas sponsored. No popup per turn.

## Integration plan (next slice)

1. Adapt the connected wagmi wallet (incl. MiniPay) into the owner signer (sign-once to
   approve the session). The session key itself is a fresh local key.
2. Onboarding: deploy the smart account (counterfactual; first op deploys it) and fund the
   stake into it (or stake from the smart account directly).
3. Replace the localStorage burner (`lib/gameWallet.ts`) with this AA path; keep MiniPay
   direct-play as a fallback.
4. Identity: the smart account address is the player; copy the owner's name/avatar onto it.
