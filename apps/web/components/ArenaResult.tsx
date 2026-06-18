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
import { useProfiles } from "../hooks/useProfiles";
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

  const profiles = useProfiles(
    d ? [...d.boards.map((b) => b.player), ...d.winners.map((w) => w.address)] : [],
  );

  if (!d || (d.winners.length === 0 && d.boards.length === 0)) return null;
  const winners = new Set(d.winners.map((w) => w.address.toLowerCase()));
  const avatarOf = (addr: string) => profiles[addr.toLowerCase()]?.avatarUrl;
  const iWon = !!address && winners.has(address.toLowerCase());
  const nameOf = (addr: string) =>
    d.players.find((p) => p.address.toLowerCase() === addr.toLowerCase())?.name ?? undefined;

  return (
    <div className="space-y-4">
      {d.winners.length > 0 && (
        <div className={cn("glass rounded-xl p-4", iWon && "ring-1 ring-neon/50 shadow-glow")}>
          <p className="mb-3 flex items-center gap-2 font-anton text-lg uppercase text-cream">
            <Trophy className="size-5 text-neon" />
            {iWon ? "You won!" : d.winners.length > 1 ? "Winners" : "Winner"}
            <span className="ml-auto font-mono text-xs font-normal text-muted-foreground">
              {d.match.prizePool} pot
            </span>
          </p>
          <div className="space-y-2">
            {d.winners.map((w) => (
              <div key={w.address} className="flex items-center justify-between">
                <Player address={w.address} name={w.name ?? undefined} imageUrl={avatarOf(w.address)} size="sm" />
                <span className="font-mono text-sm font-semibold text-neon">+{w.prize}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {d.boards.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Revealed boards · verifiable</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {d.boards.map((b) => {
              const ln = completedLines(b.board, called);
              const won = winners.has(b.player.toLowerCase());
              return (
                <div key={b.player} className={cn("glass space-y-2 rounded-xl p-3", won && "ring-1 ring-neon/40")}>
                  <div className="flex items-center justify-between">
                    <Player address={b.player} name={nameOf(b.player)} imageUrl={avatarOf(b.player)} size="sm" />
                    {won && <Badge variant="gold">WON</Badge>}
                  </div>
                  <BoardGrid board={b.board} called={called} />
                  <BingoMeter lines={ln} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
