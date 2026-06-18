"use client";

import Link from "next/link";
import type { PlayerMatch } from "../lib/api";
import { TOKENS } from "../lib/bingo";
import { cn } from "../lib/utils";

// token address (lowercased) -> symbol, for labelling stakes/prizes.
const SYMBOL: Record<string, string> = Object.fromEntries(
  Object.values(TOKENS).map((t) => [t.address.toLowerCase(), t.symbol]),
);

const OUTCOME: Record<string, { label: string; cls: string }> = {
  win: { label: "Won", cls: "text-state-open" },
  loss: { label: "Lost", cls: "text-muted-foreground" },
  cancelled: { label: "Cancelled", cls: "text-muted-foreground" },
};

function when(at: string | null): string {
  if (!at) return "";
  const d = new Date(at);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/// A player's recent games, each row linking to that arena. Read-only.
export function RecentGamesList({ games }: { games: PlayerMatch[] }) {
  if (!games.length) {
    return <p className="glass rounded-xl p-4 text-sm text-muted-foreground">No games yet.</p>;
  }
  return (
    <ul className="glass divide-y divide-white/[0.06] overflow-hidden rounded-xl">
      {games.map((g) => {
        const o = g.outcome ? OUTCOME[g.outcome] : undefined;
        const sym = SYMBOL[g.token?.toLowerCase()] ?? "";
        const amount =
          g.outcome === "win" ? `+${g.prize}` : g.outcome === "loss" ? `-${g.stake}` : g.stake;
        return (
          <li key={g.arenaId}>
            <Link
              href={`/arena/${g.arenaId}`}
              className="flex items-center justify-between gap-3 p-3 text-sm transition-colors hover:bg-white/[0.03]"
            >
              <span className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground">#{g.arenaId}</span>
                <span className={cn("font-medium", o?.cls ?? "text-gold-300")}>{o?.label ?? "Playing"}</span>
              </span>
              <span className="flex items-center gap-3">
                <span className={cn("font-mono", g.outcome === "win" ? "text-state-open" : "text-foreground")}>
                  {amount} {sym}
                </span>
                <span className="hidden w-12 text-right text-xs text-muted-foreground sm:inline">{when(g.at)}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
