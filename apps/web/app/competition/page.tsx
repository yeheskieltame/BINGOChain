"use client";

import { useEffect, useMemo, useState } from "react";
import { BackButton } from "../../components/BackButton";
import { Player } from "../../components/Player";
import { Countdown } from "../../components/Countdown";
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
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-5 py-10">
      <BackButton />
      <h1 className="font-display text-2xl font-black text-foreground">🏆 Cup</h1>
      <p className="text-sm text-muted-foreground">
        Compete for <span className="text-gold-300">$LANCE</span> by total volume staked. Live events run a countdown;
        past events keep their final standings.
      </p>

      <div className="flex gap-2">
        {(["live", "past"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors",
              tab === t ? "bg-gold-400/15 text-gold-300" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {inTab.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {inTab.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelected(c.id)}
              className={cn(
                "glass rounded-full px-3 py-1 text-xs transition-colors",
                selected === c.id ? "text-gold-300" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {c.title}
            </button>
          ))}
        </div>
      )}

      {!comps ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !sel ? (
        <p className="text-sm text-muted-foreground">No {tab} events right now.</p>
      ) : (
        <>
          <div className="glass space-y-2 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold text-foreground">{sel.title}</p>
              <Badge variant={sel.status === "live" ? "open" : "settled"} dot={sel.status === "live"}>
                {sel.status}
              </Badge>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{sel.status === "live" ? "Ends in" : "Ended"}</span>
              {sel.status === "live" ? (
                <Countdown to={sel.endsAt} />
              ) : (
                <span className="font-mono text-sm text-muted-foreground">
                  {new Date(sel.endsAt).toLocaleDateString()}
                </span>
              )}
            </div>
            {sel.prizePerWinner && (
              <p className="text-xs text-muted-foreground">
                Top {sel.topN} win <span className="text-gold-300">{sel.prizePerWinner} {sel.token}</span> each
              </p>
            )}
          </div>

          {!board ? (
            <p className="text-sm text-muted-foreground">Loading leaderboard…</p>
          ) : board.length === 0 ? (
            <p className="text-sm text-muted-foreground">No entries in this window yet.</p>
          ) : (
            <div className="glass overflow-hidden rounded-2xl">
              <table className="w-full text-sm">
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
                      className={cn("border-b border-border/40", sel.topN && r.rank <= sel.topN && "bg-gold-400/[0.05]")}
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
        </>
      )}

      <p className="text-xs text-muted-foreground/70">
        Operator-run validation (dogfooding) — participants are operator wallets. Real on-chain games, verifiable on
        Celoscan.
      </p>
    </main>
  );
}
