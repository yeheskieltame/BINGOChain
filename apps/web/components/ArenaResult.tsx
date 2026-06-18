"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Trophy } from "lucide-react";
import { getArena, type ArenaDetail } from "../lib/api";
import { completedLines } from "../lib/board";
import { BoardGrid } from "./BoardGrid";
import { BingoMeter } from "./BingoMeter";
import { Player } from "./Player";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";

/**
 * Post-game transparency: shows who won, how many lines each board made, and
 * every revealed board with the called numbers marked, so anyone can verify it.
 */
export function ArenaResult({ arenaId, called }: { arenaId: string; called: Set<number> }) {
  const { address } = useAccount();
  const [d, setD] = useState<ArenaDetail | null>(null);

  // Poll until the indexer records the winner — WinnerPaid can lag a few seconds
  // after settle, so the result fills in without a manual refresh.
  useEffect(() => {
    let on = true;
    let tries = 0;
    const load = () => {
      getArena(arenaId)
        .then((r) => {
          if (!on) return;
          setD(r);
          if (r.winners.length === 0 && ++tries < 20) setTimeout(load, 4000);
        })
        .catch(() => {
          if (on && ++tries < 20) setTimeout(load, 4000);
        });
    };
    load();
    return () => {
      on = false;
    };
  }, [arenaId]);

  if (!d || (d.winners.length === 0 && d.boards.length === 0)) return null;
  const winners = new Set(d.winners.map((w) => w.address.toLowerCase()));
  const iWon = !!address && winners.has(address.toLowerCase());
  const nameOf = (addr: string) =>
    d.players.find((p) => p.address.toLowerCase() === addr.toLowerCase())?.name ?? undefined;

  return (
    <div className="space-y-4">
      {d.winners.length > 0 && (
        <div className="glass rounded-xl p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">
            {d.winners.length > 1 ? "Winners" : "Winner"} · {d.match.prizePool} prize pool
          </p>
          <div className="space-y-2">
            {d.winners.map((w) => (
              <div key={w.address} className="flex items-center justify-between">
                <Player address={w.address} name={w.name ?? undefined} size="sm" />
                <span className="font-mono text-sm font-semibold text-gold-300">+{w.prize}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.boards.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Revealed boards · verifiable</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.boards.map((b) => (
              <div key={b.player} className="glass space-y-2 rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <Player address={b.player} name={nameOf(b.player)} size="sm" />
                  {winners.has(b.player.toLowerCase()) && <Badge variant="gold">WON</Badge>}
                </div>
                <BoardGrid board={b.board} called={called} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
