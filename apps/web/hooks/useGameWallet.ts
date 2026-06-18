"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { gameAccount, gameBalances, gameWrite } from "../lib/gameWallet";
import { bingoAbi, BINGO_ADDRESS } from "../lib/bingo";

/// React access to the owner's in-browser game wallet: its address, balances
/// (native CELO for gas + the stake token), an auto-signed contract `write`, and
/// a `refetch`. Funding the game wallet is done from the main wallet (wagmi) by
/// the caller; this hook only drives the game wallet itself.
export function useGameWallet(token: `0x${string}`) {
  const { address } = useAccount();
  const [gameAddr, setGameAddr] = useState<`0x${string}`>();
  const [gas, setGas] = useState(0n);
  const [tokenBal, setTokenBal] = useState(0n);

  useEffect(() => {
    if (!address) {
      setGameAddr(undefined);
      return;
    }
    setGameAddr(gameAccount(address).address);
  }, [address]);

  const refetch = useCallback(async () => {
    if (!address) return;
    try {
      const b = await gameBalances(address, token);
      setGas(b.celo);
      setTokenBal(b.token);
    } catch {
      /* transient RPC error */
    }
  }, [address, token]);

  useEffect(() => {
    refetch();
    const t = setInterval(refetch, 5000);
    return () => clearInterval(t);
  }, [refetch]);

  const write = useCallback(
    (functionName: string, args: readonly unknown[]) => {
      if (!address) throw new Error("connect a wallet first");
      return gameWrite(address, { address: BINGO_ADDRESS, abi: bingoAbi, functionName, args });
    },
    [address],
  );

  return { gameAddr, gas, token: tokenBal, write, refetch };
}
