import { defineChain } from "viem";
import { bingoAbi } from "./abi";

export { bingoAbi };

/// Celo Sepolia is not in viem/chains by default; define it explicitly.
export const celoSepolia = defineChain({
  id: 11_142_220,
  name: "Celo Sepolia",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo-sepolia.celo-testnet.org/"] } },
  blockExplorers: { default: { name: "Celoscan", url: "https://sepolia.celoscan.io" } },
  testnet: true,
});

export const celo = defineChain({
  id: 42_220,
  name: "Celo",
  nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
  rpcUrls: { default: { http: ["https://forno.celo.org"] } },
  blockExplorers: { default: { name: "Celoscan", url: "https://celoscan.io" } },
});

/// Deployed BingoChain proxy addresses (see contracts/deployments/*.json).
export const BINGO_ADDRESS: Record<number, `0x${string}`> = {
  42_220: "0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1", // mainnet
  11_142_220: "0xa21424B1F8c08e3d437942110081ef9F1b7589A6", // sepolia
};

/// Default chain the app targets (mainnet). Override via NEXT_PUBLIC_CHAIN_ID.
export const DEFAULT_CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 42_220) as 42_220 | 11_142_220;

export function bingoAddress(chainId: number): `0x${string}` {
  const addr = BINGO_ADDRESS[chainId];
  if (!addr) throw new Error(`BingoChain not deployed on chain ${chainId}`);
  return addr;
}

/// Board geometry constants mirrored from the contract.
export const BOARD_SIZE = 25;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
