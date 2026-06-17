"use client";

import { useEffect, useState } from "react";
import { getReferralLeaderboard, type ReferralRow } from "../lib/api";
import { Player } from "./Player";

/// Top inviters — the social leaderboard behind the referral system. Hidden
/// until there's at least one invite so it never shows an empty box.
export function ReferralLeaderboard() {
  const [rows, setRows] = useState<ReferralRow[] | null>(null);

  useEffect(() => {
    getReferralLeaderboard(10)
      .then(setRows)
      .catch(() => setRows([]));
  }, []);

  if (rows && rows.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Top inviters</h2>
      <div className="glass overflow-hidden rounded-xl">
        {!rows ? (
          <p className="p-4 text-sm text-muted-foreground">Loading…</p>
        ) : (
          <ul className="divide-y divide-border/40">
            {rows.map((r) => (
              <li key={r.address} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <span className="flex items-center gap-2">
                  <span className="w-5 font-mono text-xs text-muted-foreground">{r.rank}</span>
                  <Player address={r.address} name={r.name ?? undefined} size="sm" />
                </span>
                <span className="font-mono text-sm text-gold-300">{r.invites} invited</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
