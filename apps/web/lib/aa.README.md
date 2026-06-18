# Gasless play via account abstraction (ERC-4337)

`lib/aa.ts` is the foundation for **industry-standard gasless, popup-free gameplay**:
the player is a **ZeroDev Kernel smart account** on Celo, the connected wallet is its
**owner**, and a **session key** scoped to BingoChain's gameplay functions auto-signs
every move while a **Pimlico paymaster sponsors the gas**. The game contract is unchanged
(the smart account is `msg.sender`).

Chosen because: ERC-4337 + session keys + paymaster is the standard for onchain games; it
needs zero contract changes (unlike EIP-2771 meta-tx). We use **Pimlico** for the bundler +
paymaster (ZeroDev gates Celo behind a paid plan; Pimlico is pay-as-you-go and is the same
infra ZeroDev routes to on Celo).

## Reality of "gasless"
Sponsored mainnet gas is never free — someone funds the paymaster. The good news: on Celo
gas is sub-cent, so a few dollars in the Pimlico paymaster sponsors thousands of moves.
There is no provider that sponsors mainnet gas for free; the only zero-infra option is Celo
native fee abstraction (pay gas in cUSD, no CELO) — but that still costs one signature per turn.

## What you must set up (one-time, unblocks everything)

1. Create an API key at **dashboard.pimlico.io**.
2. Add a **sponsorship policy** for **Celo mainnet (chain 42220)** and put a little balance in
   the paymaster (deposit, or a card for pay-as-you-go). Scope the policy to the BingoChain
   proxy `0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1` to cap spend.
3. Set the env var (Vercel project env + local `.env.local`):
   ```
   NEXT_PUBLIC_PIMLICO_API_KEY=<your pimlico api key>
   ```

`aaConfigured()` is false until this is set, so the UI can hide smooth play until ready.

## How the pieces fit (lib/aa.ts)

- `ownerKernel(owner)` - the player's smart account + a Pimlico-sponsored client.
- `approveGameSession(owner, sessionKeyAddress)` - owner signs once; returns a serialized
  approval. The session key may only call `commitBoard / callNumber / claimBingo /
  revealBoard` on BingoChain, with `valueLimit: 0` (can never move funds).
- `gameSessionClient(approval, sessionSigner)` - rebuilds the session account and returns a
  client that auto-signs scoped moves, gas sponsored. No popup per turn.

## Integration plan (next slice)

1. Adapt the connected wagmi wallet (incl. MiniPay) into the owner signer (sign-once to
   approve the session). The session key itself is a fresh local key.
2. Onboarding: deploy the smart account (counterfactual; first op deploys it) and stake from it.
3. Replace the localStorage burner (`lib/gameWallet.ts`) with this AA path; keep MiniPay
   direct-play as a fallback.
4. Identity: the smart account address is the player; copy the owner's name/avatar onto it.
