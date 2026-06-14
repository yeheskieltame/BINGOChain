"use client";

import { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID } from "../lib/bingo";

export type ArenaSummary = {
  id: bigint;
  creator: `0x${string}`;
  token: `0x${string}`;
  stake: bigint;
  maxPlayers: number;
};

/// Lists recent arenas by scanning ArenaCreated logs (newest first).
export function useArenas() {
  const client = usePublicClient({ chainId: CHAIN_ID });
  const [arenas, setArenas] = useState<ArenaSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!client) return;
    let active = true;
    (async () => {
      try {
        const latest = await client.getBlockNumber();
        const fromBlock = latest > 100_000n ? latest - 100_000n : 0n;
        const logs = await client.getContractEvents({
          address: BINGO_ADDRESS,
          abi: bingoAbi,
          eventName: "ArenaCreated",
          fromBlock,
          toBlock: latest,
        });
        if (!active) return;
        setArenas(
          logs
            .map((l) => ({
              id: l.args.arenaId as bigint,
              creator: l.args.creator as `0x${string}`,
              token: l.args.token as `0x${string}`,
              stake: l.args.stake as bigint,
              maxPlayers: l.args.maxPlayers as number,
            }))
            .reverse(),
        );
      } catch {
        if (active) setArenas([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [client]);

  return { arenas, loading };
}
