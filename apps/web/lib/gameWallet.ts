"use client";

import { createWalletClient, createPublicClient, http, parseEther, type Hex, type Abi } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { celo } from "./bingo";

const ERC20_MIN = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
] as const;

// Smooth play ("gasless feel") without a contract change: each owner gets a
// persistent in-browser GAME WALLET. The owner funds it once (stake + a little
// CELO) from their main wallet; the game wallet then joins and plays every turn,
// auto-signing with NO popup. The key is recoverable (sweepable) at any time, so
// no funds get stranded. Identity is preserved by copying the owner's profile
// (name + avatar) onto the game wallet address off-chain.
//
// NOTE: an in-browser key is a deliberate session-scoped trust trade-off for UX.
// Fund it with only what a game needs; sweep winnings back to your main wallet.

const RPC = process.env.NEXT_PUBLIC_CELO_MAINNET_RPC || "https://forno.celo.org";
const keyFor = (owner: string) => `bingo:gamewallet:${owner.toLowerCase()}`;

/// Load (or create + persist) the game wallet private key for an owner address.
export function loadGameKey(owner: string): Hex {
  const k = keyFor(owner);
  let pk = (typeof window !== "undefined" ? (localStorage.getItem(k) as Hex | null) : null) ?? null;
  if (!pk) {
    pk = generatePrivateKey();
    if (typeof window !== "undefined") localStorage.setItem(k, pk);
  }
  return pk;
}

export function gameAccount(owner: string) {
  return privateKeyToAccount(loadGameKey(owner));
}

export const gamePublic = createPublicClient({ chain: celo, transport: http(RPC) });

function gameClient(owner: string) {
  return createWalletClient({ account: gameAccount(owner), chain: celo, transport: http(RPC) });
}

/// Auto-signed contract write from the game wallet (no wallet popup). Resolves
/// once the tx is mined.
export async function gameWrite(
  owner: string,
  call: { address: `0x${string}`; abi: Abi; functionName: string; args: readonly unknown[] },
): Promise<Hex> {
  const hash = await gameClient(owner).writeContract(call as Parameters<ReturnType<typeof gameClient>["writeContract"]>[0]);
  await gamePublic.waitForTransactionReceipt({ hash, timeout: 120_000 });
  return hash;
}

/// Recover funds: send the game wallet's full token balance, then its CELO
/// (minus a small gas buffer), back to `to`. Always available so nothing is
/// stranded in the game wallet.
export async function gameSweep(owner: string, to: `0x${string}`, token: `0x${string}`): Promise<void> {
  const acct = gameAccount(owner);
  const client = gameClient(owner);
  const tokBal = (await gamePublic.readContract({
    address: token,
    abi: ERC20_MIN,
    functionName: "balanceOf",
    args: [acct.address],
  })) as bigint;
  if (tokBal > 0n) {
    const h = await client.writeContract({ address: token, abi: ERC20_MIN, functionName: "transfer", args: [to, tokBal] });
    await gamePublic.waitForTransactionReceipt({ hash: h });
  }
  const bal = await gamePublic.getBalance({ address: acct.address });
  const buffer = parseEther("0.02"); // leave a little for the transfer's own gas
  if (bal > buffer) {
    const h = await client.sendTransaction({ to, value: bal - buffer });
    await gamePublic.waitForTransactionReceipt({ hash: h });
  }
}

/// Native CELO + token balances of the game wallet, for the funding UI.
export async function gameBalances(owner: string, token: `0x${string}`) {
  const addr = gameAccount(owner).address;
  const [celoBal, tokenBal] = await Promise.all([
    gamePublic.getBalance({ address: addr }),
    gamePublic.readContract({
      address: token,
      abi: [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] }],
      functionName: "balanceOf",
      args: [addr],
    }) as Promise<bigint>,
  ]);
  return { address: addr, celo: celoBal, token: tokenBal };
}
