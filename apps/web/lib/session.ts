"use client";

// No-popup gameplay via the contract's on-chain session keys (v1.3.0). The player
// authorizes an in-app session key once (setSessionKey, one signature); that key
// then auto-signs every turn (callNumber / claimBingo / revealBoard) with no popup,
// paying gas NATIVELY in a currency the player chooses. No third party, no relayer.
// The on-chain player stays the connected wallet (identity kept); the session key
// just acts for them and can never join, withdraw, or move funds.

import { createWalletClient, createPublicClient, http, erc20Abi, type Hex, type Address, type LocalAccount } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { celo } from "viem/chains"; // viem's Celo chain ships the CIP-64 serializer for feeCurrency
import { bingoAbi, BINGO_ADDRESS } from "./bingo";

const RPC = process.env.NEXT_PUBLIC_CELO_MAINNET_RPC || "https://forno.celo.org";

/// Gas currencies the player can pick to fund the session key. Celo fee
/// abstraction (CIP-64): CELO is native; cUSD is a fee currency directly; USDT
/// pays gas via its registered fee adapter. `erc20` is what the player transfers
/// to the session key; `feeCurrency` is what gas is charged in (undefined = CELO).
// `fund` is sized to cover a whole game: bingo runs up to 25 calls split between
// players, plus claim + reveal, and each move reserves gas upfront, so a tiny
// float runs dry mid-game. These amounts leave headroom; the arena also falls
// back to the connected wallet if the session key still runs out (e.g. a gas spike).
export const GAS_TOKENS = {
  CELO: { label: "CELO", erc20: undefined as Address | undefined, feeCurrency: undefined as Address | undefined, decimals: 18, fund: "0.2" },
  cUSD: { label: "cUSD", erc20: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address, feeCurrency: "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address, decimals: 18, fund: "0.4" },
  USDT: { label: "USDT", erc20: "0x48065fbBE25f71C9282ddf5e1cD6D6A887483D5e" as Address, feeCurrency: "0x0E2A3e05bc9A16F5292A6170456A710cb89C6f72" as Address, decimals: 6, fund: "0.4" },
} as const;
export type GasChoice = keyof typeof GAS_TOKENS;

const keyFor = (owner: string) => `bingo:sessionkey:${owner.toLowerCase()}`;
const feeFor = (owner: string) => `bingo:sessionfee:${owner.toLowerCase()}`;
const mem: Record<string, Hex> = {};

/// Load (or create + persist) the player's in-app session key. Never throws.
export function loadSessionKey(owner: string): Hex {
  const k = keyFor(owner);
  try {
    const existing = localStorage.getItem(k) as Hex | null;
    if (existing) return existing;
    const pk = generatePrivateKey();
    localStorage.setItem(k, pk);
    return pk;
  } catch {
    if (!mem[k]) mem[k] = generatePrivateKey();
    return mem[k];
  }
}

export const sessionAccount = (owner: string): LocalAccount => privateKeyToAccount(loadSessionKey(owner));

export function saveGasChoice(owner: string, choice: GasChoice) {
  try {
    localStorage.setItem(feeFor(owner), choice);
  } catch {
    /* ignore */
  }
}
export function loadGasChoice(owner: string): GasChoice {
  try {
    const c = localStorage.getItem(feeFor(owner)) as GasChoice | null;
    return c && c in GAS_TOKENS ? c : "CELO";
  } catch {
    return "CELO";
  }
}

const pub = createPublicClient({ chain: celo, transport: http(RPC) });

/// Is the session key funded for gas in the chosen currency?
export async function sessionFunded(owner: string): Promise<boolean> {
  const opt = GAS_TOKENS[loadGasChoice(owner)];
  const address = sessionAccount(owner).address;
  if (!opt.erc20) return (await pub.getBalance({ address })) > 0n;
  const bal = (await pub.readContract({ address: opt.erc20, abi: erc20Abi, functionName: "balanceOf", args: [address] })) as bigint;
  return bal > 0n;
}

/// Auto-signed BingoChain call from the session key (no popup), gas paid in the
/// player's chosen currency.
export async function sessionWrite(owner: string, functionName: string, args: readonly unknown[]): Promise<Hex> {
  const opt = GAS_TOKENS[loadGasChoice(owner)];
  const wallet = createWalletClient({ account: sessionAccount(owner), chain: celo, transport: http(RPC) });
  const hash = await wallet.writeContract({
    address: BINGO_ADDRESS,
    abi: bingoAbi,
    functionName,
    args,
    ...(opt.feeCurrency ? { feeCurrency: opt.feeCurrency } : {}),
  } as Parameters<typeof wallet.writeContract>[0]);
  await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  return hash;
}
