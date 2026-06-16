import { defineChain } from "viem";
import { bingoAbi } from "./abi";

export { bingoAbi };

export const celo = defineChain({
  id: 42_220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo.org"] } },
  blockExplorers: { default: { name: "Celoscan", url: "https://celoscan.io" } },
  // Canonical Multicall3 (deployed at the same address on every chain incl. Celo).
  // Lets the lobby batch many getArena() reads into one RPC call so it scales to
  // hundreds of concurrent arenas without N round-trips.
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

/// Mainnet-only project. The deployed BingoChain proxy on Celo mainnet
/// (see contracts/deployments/celo-mainnet.json).
export const CHAIN_ID = 42_220 as const;
export const BINGO_ADDRESS = "0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1" as const;

/// Whitelisted settlement tokens on Celo mainnet (owner-enabled via allowToken).
export const TOKENS = {
  LANCE: { address: "0xb70c9Cd73428Afe51eEEA832C49E8840D3f85cA2", decimals: 18, symbol: "LANCE" },
  CELO: { address: "0x471EcE3750Da237f93B8E339c536989b8978a438", decimals: 18, symbol: "CELO" },
  cUSD: { address: "0x765DE816845861e75A25fCA122bb6898B8B1282a", decimals: 18, symbol: "cUSD" },
  USDC: { address: "0xcebA9300f2b948710d2653dD7B07f33A8B32118C", decimals: 6, symbol: "USDC" },
  USDT: { address: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e", decimals: 6, symbol: "USDT" },
} as const;

/// On-chain minimum stake per token (matches the core's minStakeOf). The create
/// form seeds the stake field with this when the token changes.
export const MIN_STAKE: Record<keyof typeof TOKENS, string> = {
  LANCE: "10",
  CELO: "1",
  cUSD: "0.5",
  USDC: "0.5",
  USDT: "0.5",
};

/// Board geometry constants mirrored from the contract.
export const BOARD_SIZE = 25;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
