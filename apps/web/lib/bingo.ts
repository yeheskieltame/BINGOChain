import { defineChain } from "viem";
import { bingoAbi } from "./abi";

export { bingoAbi };

export const celo = defineChain({
  id: 42_220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo.org"] } },
  blockExplorers: { default: { name: "Celoscan", url: "https://celoscan.io" } },
});

/// Mainnet-only project. The deployed BingoChain proxy on Celo mainnet
/// (see contracts/deployments/celo-mainnet.json).
export const CHAIN_ID = 42_220 as const;
export const BINGO_ADDRESS = "0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1" as const;

/// Board geometry constants mirrored from the contract.
export const BOARD_SIZE = 25;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
