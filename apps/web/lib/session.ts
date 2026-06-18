"use client";

// No-popup gameplay via the contract's on-chain session keys (v1.3.0). The player
// authorizes an in-app session key once (setSessionKey, one signature); that key
// then auto-signs every turn (callNumber / claimBingo / revealBoard) with no popup,
// paying gas NATIVELY — CELO, or cUSD via Celo fee abstraction (CIP-64). No third
// party, no relayer. The on-chain player stays the connected wallet (identity kept);
// the session key just acts for them and can never join, withdraw, or move funds.

import { createWalletClient, createPublicClient, http, erc20Abi, type Hex, type Address, type LocalAccount } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { celo } from "viem/chains"; // viem's Celo chain ships the CIP-64 serializer for feeCurrency
import { bingoAbi, BINGO_ADDRESS, TOKENS } from "./bingo";

const RPC = process.env.NEXT_PUBLIC_CELO_MAINNET_RPC || "https://forno.celo.org";
const keyFor = (owner: string) => `bingo:sessionkey:${owner.toLowerCase()}`;
const mem: Record<string, Hex> = {};

/// Load (or create + persist) the player's in-app session key. Never throws: if
/// storage is blocked it keeps an in-session key (sweepable; warn the player).
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

const pub = createPublicClient({ chain: celo, transport: http(RPC) });

/// Native CELO + cUSD balances of the session key, and the feeCurrency to use:
/// undefined => pay gas in native CELO; cUSD address => pay gas in cUSD (CIP-64).
export async function sessionGas(owner: string) {
  const address = sessionAccount(owner).address;
  const cusd = TOKENS.cUSD.address as Address;
  const [celoBal, cusdBal] = await Promise.all([
    pub.getBalance({ address }),
    pub.readContract({ address: cusd, abi: erc20Abi, functionName: "balanceOf", args: [address] }) as Promise<bigint>,
  ]);
  const feeCurrency = celoBal > 0n ? undefined : cusdBal > 0n ? cusd : undefined;
  return { address, celo: celoBal, cusd: cusdBal, feeCurrency, funded: celoBal > 0n || cusdBal > 0n };
}

/// Auto-signed BingoChain call from the session key (no popup), gas paid natively.
export async function sessionWrite(
  owner: string,
  functionName: string,
  args: readonly unknown[],
  feeCurrency?: Address,
): Promise<Hex> {
  const wallet = createWalletClient({ account: sessionAccount(owner), chain: celo, transport: http(RPC) });
  const hash = await wallet.writeContract({
    address: BINGO_ADDRESS,
    abi: bingoAbi,
    functionName,
    args,
    ...(feeCurrency ? { feeCurrency } : {}),
  } as Parameters<typeof wallet.writeContract>[0]);
  await pub.waitForTransactionReceipt({ hash, timeout: 120_000 });
  return hash;
}
