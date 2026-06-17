"use client";

import { useReadContract } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID } from "../lib/bingo";

// Poll the chain a few times a second so the arena view (turn, called numbers,
// phase) stays live during play without the player having to refresh. Turn-based
// play moves in seconds, so a short interval reads "realtime" enough.
const live = { refetchInterval: 3000, refetchIntervalInBackground: false } as const;

/// Reads a single arena's full state: the packed record, player list, and the
/// numbers called so far — all auto-refreshing while the page is open.
export function useArena(id: bigint) {
  const arena = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "getArena",
    args: [id],
    chainId: CHAIN_ID,
    query: live,
  });

  const players = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "getPlayers",
    args: [id],
    chainId: CHAIN_ID,
    query: live,
  });

  const calls = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "getCallSequence",
    args: [id],
    chainId: CHAIN_ID,
    query: live,
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
