"use client";

import { useEffect, useState } from "react";
import { getArena, type ArenaDetail } from "../lib/api";
import { BoardGrid } from "./BoardGrid";
import { Player } from "./Player";
import { Badge } from "./ui/badge";

/**
 * Post-game transparency: shows the winner(s) and every revealed board with the
 * called numbers marked, so anyone can verify which cells were checked.
 */
export function ArenaResult({ arenaId, called }: { arenaId: string; called: Set<number> }) {
  const [d, setD] = useState<ArenaDetail | null>(null);

  useEffect(() => {
    getArena(arenaId).then(setD).catch(() => {});
  }, [arenaId]);

  if (!d || (d.winners.length === 0 && d.boards.length === 0)) return null;
  const winners = new Set(d.winners.map((w) => w.address.toLowerCase()));
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
