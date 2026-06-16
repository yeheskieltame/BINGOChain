"use client";

import { useCallback, useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID } from "../lib/bingo";

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

// forno (and most public RPCs) reject huge eth_getLogs ranges, so the scan walks
// backward in safe chunks and stops once it has enough recent arenas. Without
// chunking, a single wide range silently fails — fatal once the contract has
// weeks of history and the lobby holds hundreds of concurrent arenas.
const LOG_CHUNK = 10_000n;
const MAX_SCAN_BLOCKS = 300_000n;
const MAX_ARENAS = 60;
const REFRESH_MS = 15_000;

export function useArenas() {
  const client = usePublicClient({ chainId: CHAIN_ID });
  const [arenas, setArenas] = useState<ArenaSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: { aborted: boolean }) => {
      if (!client) return;
      try {
        const latest = await client.getBlockNumber();
        const floor = latest > MAX_SCAN_BLOCKS ? latest - MAX_SCAN_BLOCKS : 0n;

        // newest → oldest in chunks, until we have MAX_ARENAS or run out of range
        const created: Omit<ArenaSummary, "joinedCount" | "state">[] = [];
        let to = latest;
        while (to >= floor && created.length < MAX_ARENAS) {
          const from = to > floor + LOG_CHUNK ? to - LOG_CHUNK : floor;
          const logs = await client.getContractEvents({
            address: BINGO_ADDRESS,
            abi: bingoAbi,
            eventName: "ArenaCreated",
            fromBlock: from,
            toBlock: to,
          });
          for (const l of logs.reverse()) {
            created.push({
              id: l.args.arenaId as bigint,
              creator: l.args.creator as `0x${string}`,
              token: l.args.token as `0x${string}`,
              stake: l.args.stake as bigint,
              maxPlayers: Number(l.args.maxPlayers),
            });
          }
          if (from === floor) break;
          to = from - 1n;
        }
        if (signal?.aborted) return;

        const recent = created.slice(0, MAX_ARENAS);

        // enrich with live state (one batched multicall, not N round-trips)
        let enriched: ArenaSummary[];
        try {
          const results = await client.multicall({
            allowFailure: true,
            contracts: recent.map((a) => ({
              address: BINGO_ADDRESS,
              abi: bingoAbi,
              functionName: "getArena",
              args: [a.id],
            })),
          });
          enriched = recent.map((a, i) => {
            const r = results[i];
            const ar = r?.status === "success" ? (r.result as unknown as { state: number; joinedCount: number }) : undefined;
            return {
              ...a,
              joinedCount: ar ? Number(ar.joinedCount) : 0,
              state: ar ? ARENA_STATES[Number(ar.state)] ?? "created" : "created",
            };
          });
        } catch {
          enriched = recent.map((a) => ({ ...a, joinedCount: 0, state: "created" as ArenaState }));
        }
        if (signal?.aborted) return;

        setArenas(enriched);
        setError(null);
      } catch (e) {
        // Surface the failure instead of masquerading as "no arenas" — silent
        // empties hid RPC range failures during scale testing.
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
