"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID } from "../lib/bingo";
import { API_URL } from "../lib/api";

/// GameState enum, mirrored from the contract (BingoTypes.GameState).
export const ARENA_STATES = ["created", "committed", "playing", "revealing", "settled", "cancelled"] as const;
export type ArenaState = (typeof ARENA_STATES)[number];

export type ArenaSummary = {
  id: bigint;
  creator: `0x${string}`;
  token: `0x${string}`;
  stake: bigint;
  maxPlayers: number;
  joinedCount: number;
  state: ArenaState;
};

const MAX_ARENAS = 60;
const REFRESH_MS = 15_000;

// forno rejects eth_getLogs from the browser ("not whitelisted"), so the lobby
// gets the recent arena ids from the backend index, then reads live state with a
// single batched multicall (eth_call, which IS whitelisted).
export function useArenas() {
  const client = usePublicClient({ chainId: CHAIN_ID });
  const [arenas, setArenas] = useState<ArenaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: { aborted: boolean }) => {
      if (!client) return;
      try {
        const res = await fetch(`${API_URL}/api/arenas?limit=${MAX_ARENAS}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`api ${res.status}`);
        const ids = (await res.json()) as string[];
        if (signal?.aborted) return;
        if (!ids.length) {
          setArenas([]);
          setError(null);
          return;
        }

        const results = await client.multicall({
          allowFailure: true,
          contracts: ids.map((id) => ({
            address: BINGO_ADDRESS,
            abi: bingoAbi,
            functionName: "getArena",
            args: [BigInt(id)],
          })),
        });
        if (signal?.aborted) return;

        const enriched = ids
          .map((id, i) => {
            const r = results[i];
            if (r?.status !== "success") return null;
            const a = r.result as unknown as {
              creator: `0x${string}`;
              token: `0x${string}`;
              stake: bigint;
              maxPlayers: number;
              joinedCount: number;
              state: number;
            };
            return {
              id: BigInt(id),
              creator: a.creator,
              token: a.token,
              stake: a.stake,
              maxPlayers: Number(a.maxPlayers),
              joinedCount: Number(a.joinedCount),
              state: ARENA_STATES[Number(a.state)] ?? "created",
            } as ArenaSummary;
          })
          .filter((x): x is ArenaSummary => x !== null);

        setArenas(enriched);
        setError(null);
      } catch (e) {
        if (!signal?.aborted) setError(e instanceof Error ? e.message : "failed to load arenas");
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [client],
  );

  useEffect(() => {
    const signal = { aborted: false };
    load(signal);
    const timer = setInterval(() => load(signal), REFRESH_MS); // live lobby refresh
    return () => {
      signal.aborted = true;
      clearInterval(timer);
    };
  }, [load]);

  return { arenas, loading, error, refresh: () => load() };
}
