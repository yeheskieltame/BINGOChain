"use client";

import { useReadContract } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID } from "../lib/bingo";

/// Reads a single arena's full state: the packed record, player list, and the
/// numbers called so far.
export function useArena(id: bigint) {
  const arena = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "getArena",
    args: [id],
    chainId: CHAIN_ID,
  });

  const players = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "getPlayers",
    args: [id],
    chainId: CHAIN_ID,
  });

  const calls = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "getCallSequence",
    args: [id],
    chainId: CHAIN_ID,
  });

  return {
    arena: arena.data,
    players: players.data ?? [],
    calls: (calls.data ?? []).map(Number),
    refetch: () => {
      arena.refetch();
      players.refetch();
      calls.refetch();
    },
  };
}
