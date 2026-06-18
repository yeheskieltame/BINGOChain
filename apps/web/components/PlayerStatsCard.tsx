"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { getPlayer, type PlayerData } from "../lib/api";
import { AchievementBadges } from "./AchievementBadges";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function PlayerStatsCard() {
  const { address } = useAccount();
  const [d, setD] = useState<PlayerData | null>(null);

  useEffect(() => {
    if (address) getPlayer(address).then(setD).catch(() => {});
  }, [address]);

  if (!address) return null;
  const s = d?.stats;

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Games" value={s ? String(s.games) : "0"} />
        <Stat label="Wins" value={s ? String(s.wins) : "0"} />
        <Stat label="Volume" value={s ? s.volume : "0"} />
        <Stat label="Won" value={s ? s.earnings : "0"} />
      </div>

      <AchievementBadges stats={s ?? null} />

      {d?.recent?.length ? (
        <div className="glass rounded-xl p-4">
          <p className="mb-2 text-xs uppercase tracking-wider text-muted-foreground">Recent games</p>
          <ul className="space-y-1.5 text-sm">
            {d.recent.slice(0, 6).map((m) => (
              <li key={m.arenaId} className="flex items-center justify-between gap-3">
                <span className="font-mono text-muted-foreground">#{m.arenaId}</span>
                <span
                  className={
                    m.outcome === "win"
                      ? "text-state-open"
                      : m.outcome === "cancelled"
                        ? "text-muted-foreground"
                        : "text-foreground"
                  }
                >
                  {m.outcome ?? "playing"}
                </span>
                <span className="font-mono text-foreground">
                  {m.outcome === "win" ? `+${m.prize}` : m.stake}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
