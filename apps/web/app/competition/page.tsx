"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Player } from "../../components/Player";
import { BackButton } from "../../components/BackButton";
import { getLeaderboard, getStats, type LeaderboardRow, type Stats } from "../../lib/api";

const MEDAL = ["🥇", "🥈", "🥉"];

/** BINGOChain leaderboard — live from the backend indexer, ranked by total
 *  $LANCE volume staked across all arenas. Replaces the old static JSON. */
export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let on = true;
    Promise.all([getLeaderboard(50), getStats()])
      .then(([r, s]) => {
        if (!on) return;
        setRows(r);
        setStats(s);
      })
      .catch(() => on && setErr(true));
    return () => {
      on = false;
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-5 py-10">
      <BackButton />
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-foreground">🏆 Leaderboard</h1>
        <Link href="/arenas" className="text-sm text-muted-foreground hover:text-foreground">
          Arenas →
        </Link>
      </div>

      <p className="text-sm text-muted-foreground">
        Live ranking by total <span className="text-gold-300">$LANCE</span> volume staked across all BINGOChain
        arenas — updates as games settle on-chain.
      </p>

      {stats && (
        <div className="grid grid-cols-4 gap-2 text-center">
          {[
            ["Players", stats.players],
            ["Games", stats.games],
            ["Volume", stats.volume],
            ["Prizes", stats.prizesPaid],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-xl p-3">
              <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{k}</p>
              <p className="mt-1 font-mono text-sm font-semibold text-foreground">{v}</p>
            </div>
          ))}
        </div>
      )}

      {rows ? (
        rows.length ? (
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
                {rows.map((r) => (
                  <tr key={r.address} className={`border-b border-border/40 ${r.rank <= 3 ? "bg-gold-400/[0.05]" : ""}`}>
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
        ) : (
          <p className="text-sm text-muted-foreground">No games indexed yet.</p>
        )
      ) : err ? (
        <p className="text-sm text-muted-foreground">Leaderboard unavailable right now.</p>
      ) : (
        <p className="text-sm text-muted-foreground">Loading leaderboard…</p>
      )}

      <p className="text-xs text-muted-foreground/70">
        Operator-run validation (dogfooding) — participants are operator wallets. Real on-chain games, verifiable on
        Celoscan.
      </p>
    </main>
  );
}
