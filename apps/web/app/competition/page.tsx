"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Row = { rank: number; address: string; games: number; volume: string; won: boolean; prizeTx: string | null };
type Comp = {
  competition: string;
  stake: string;
  prizePerWinner: string;
  topN: number;
  totalGames: number;
  totalVolume: string;
  participants: Row[];
  bountyId?: string;
  claudelanceUrl?: string;
};

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** BingoChain Volume Cup — the competition spec + LIVE leaderboard. The client
 *  (BingoChain) hosts this; the Claudelance bounty anchors its hash on-chain.
 *  Ranked by VOLUME (total $LANCE staked), not wins. Top N win $LANCE. */
export default function CompetitionPage() {
  const [c, setC] = useState<Comp | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/competition.json", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setC)
      .catch(() => setErr(true));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gold-400">🏆 BingoChain Volume Cup</h1>
        <Link href="/arenas" className="text-sm text-neutral-400 hover:text-neutral-200">Arenas →</Link>
      </div>

      <div className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5 text-sm text-neutral-300">
        <p className="font-semibold text-neutral-100">How it works</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-neutral-400">
          <li>Play BingoChain arenas staked in <span className="text-gold-400">$LANCE</span> and submit your settlement tx hashes.</li>
          <li>Ranked by <span className="font-semibold text-neutral-200">VOLUME</span> (total $LANCE staked) — not by wins.</li>
          <li>Top <span className="text-neutral-200">{c?.topN ?? 10}</span> by volume each win{" "}
            <span className="text-gold-400">{c?.prizePerWinner ?? "20"} $LANCE</span>.</li>
        </ul>
        {c?.claudelanceUrl ? (
          <p className="mt-3 text-xs text-neutral-500">
            On-chain bounty:{" "}
            <a href={c.claudelanceUrl} target="_blank" rel="noreferrer" className="text-gold-400 underline-offset-2 hover:underline">
              Claudelance #{c.bountyId}
            </a>
          </p>
        ) : null}
      </div>

      {c ? (
        <>
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            {[["Prize / winner", `${c.prizePerWinner} $LANCE`], ["Total games", String(c.totalGames)], ["Total volume", `${c.totalVolume} $LANCE`]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
                <div className="text-neutral-500">{k}</div>
                <div className="mt-0.5 font-mono text-sm font-semibold text-neutral-100">{v}</div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-2xl border border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-900 text-left text-xs text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5">#</th>
                  <th className="px-4 py-2.5">Player</th>
                  <th className="px-4 py-2.5 text-right">Games</th>
                  <th className="px-4 py-2.5 text-right">Volume</th>
                </tr>
              </thead>
              <tbody>
                {c.participants.map((p) => (
                  <tr key={p.address} className={`border-t border-neutral-800 ${p.won ? "bg-gold-400/[0.06]" : ""}`}>
                    <td className="px-4 py-2.5 font-mono">{p.won ? "🏆" : ""} {p.rank}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-neutral-300">{short(p.address)}</td>
                    <td className="px-4 py-2.5 text-right font-mono">{p.games}</td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{p.volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-neutral-600">
            Operator-run validation (dogfooding) — all participants are operator wallets. Real on-chain games; results are verifiable on Celoscan.
          </p>
        </>
      ) : err ? (
        <p className="text-sm text-neutral-500">No active competition right now.</p>
      ) : (
        <p className="text-sm text-neutral-500">Loading leaderboard…</p>
      )}
    </main>
  );
}
