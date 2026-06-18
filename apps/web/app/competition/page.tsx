"use client";

import { useEffect, useMemo, useState } from "react";
import { BackButton } from "../../components/BackButton";
import { PageHeader } from "../../components/PageHeader";
import { CupEventCard } from "../../components/CupEventCard";
import { Player } from "../../components/Player";
import { Badge } from "../../components/ui/badge";
import { cn } from "../../lib/utils";
import {
  getCompetitions,
  getCompetitionLeaderboard,
  type Competition,
  type LeaderboardRow,
} from "../../lib/api";

const MEDAL = ["🥇", "🥈", "🥉"];

/** Cup — competition events: a Live tab (with countdown) and a Past tab, each
 *  with a leaderboard scoped to the event's window. */
export default function CupPage() {
  const [comps, setComps] = useState<Competition[] | null>(null);
  const [tab, setTab] = useState<"live" | "past">("live");
  const [selected, setSelected] = useState<string | null>(null);
  const [board, setBoard] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    getCompetitions()
      .then(setComps)
      .catch(() => setComps([]));
  }, []);

  const inTab = useMemo(
    () => (comps ?? []).filter((c) => (tab === "live" ? c.status === "live" : c.status === "past")),
    [comps, tab],
  );

  useEffect(() => {
    setSelected(inTab[0]?.id ?? null);
  }, [inTab]);

  useEffect(() => {
    if (!selected) {
      setBoard(null);
      return;
    }
    setBoard(null);
    getCompetitionLeaderboard(selected)
      .then(setBoard)
      .catch(() => setBoard([]));
  }, [selected]);

  const sel = (comps ?? []).find((c) => c.id === selected) ?? null;

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-5 py-10 md:px-6">
      <BackButton />
      <PageHeader
        eyebrow="Tournament"
        title="Cup"
        accent="for glory"
        subtitle={
          <>
            Compete for <span className="text-neon">$LANCE</span> by total volume staked. Live events run a countdown;
            past events keep their final standings.
          </>
        }
      />

      <div className="flex gap-2">
        {(["live", "past"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-4 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors",
              tab === t
                ? "bg-neon/15 text-neon ring-1 ring-neon/30"
                : "text-muted-foreground hover:bg-white/5 hover:text-cream",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {!comps ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : inTab.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {tab} events right now.</p>
      ) : (
        <>
          {/* All concurrent cups at once — each scopes a different window. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {inTab.map((c) => (
              <CupEventCard key={c.id} event={c} selected={selected === c.id} onSelect={() => setSelected(c.id)} />
            ))}
          </div>

          {sel && (
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-anton text-xl uppercase text-cream">
                  {sel.title} <span className="text-muted-foreground">· full standings</span>
                </h2>
                <Badge variant={sel.status === "live" ? "open" : "settled"} dot={sel.status === "live"}>
                  {sel.status}
                </Badge>
              </div>
              {!board ? (
                <p className="text-sm text-muted-foreground">Loading leaderboard…</p>
              ) : board.length === 0 ? (
                <p className="text-sm text-muted-foreground">No entries in this window yet.</p>
              ) : (
                <div className="glass overflow-x-auto rounded-2xl">
                  <table className="w-full min-w-[460px] text-sm">
                    <thead className="text-left text-xs text-muted-foreground">
                      <tr className="border-b border-border">
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Player</th>
                        <th className="px-4 py-3 text-right">Games</th>
                        <th className="px-4 py-3 text-right">Wins</th>
                        <th className="px-4 py-3 text-right">Volume</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.map((r) => (
                        <tr
                          key={r.address}
                          className={cn("border-b border-border/40", sel.topN && r.rank <= sel.topN && "bg-neon/[0.05]")}
                        >
                          <td className="px-4 py-2.5 font-mono">{r.rank <= 3 ? MEDAL[r.rank - 1] : r.rank}</td>
                          <td className="px-4 py-2.5">
                            <Player address={r.address} name={r.name ?? undefined} size="sm" />
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono">{r.games}</td>
                          <td className="px-4 py-2.5 text-right font-mono">{r.wins}</td>
                          <td className="px-4 py-2.5 text-right font-mono font-semibold">{r.volume}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      )}

      <p className="text-xs text-muted-foreground/70">
        Operator-run validation (dogfooding) — participants are operator wallets. Real on-chain games, verifiable on
        Celoscan.
      </p>
    </main>
  );
}
