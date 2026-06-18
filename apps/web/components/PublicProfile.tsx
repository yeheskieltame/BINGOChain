"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { getPlayer, type PlayerData } from "../lib/api";
import { ProfileHeader } from "./ProfileHeader";
import { AchievementBadges } from "./AchievementBadges";
import { RecentGamesList } from "./RecentGamesList";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass rounded-xl p-3 text-center">
      <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-mono text-lg font-semibold text-foreground">{value}</p>
    </div>
  );
}

/// Read-only public view of any player: header (avatar/name/address/bio), stats,
/// achievements, and recent games. Fetches /api/player/:address on mount.
export function PublicProfile({ address }: { address: string }) {
  const { address: connected } = useAccount();
  const [data, setData] = useState<PlayerData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let on = true;
    setLoading(true);
    getPlayer(address)
      .then((d) => on && setData(d))
      .catch(() => on && setData(null))
      .finally(() => on && setLoading(false));
    return () => {
      on = false;
    };
  }, [address]);

  const isYou = !!connected && connected.toLowerCase() === address.toLowerCase();
  const s = data?.stats;
  const winRate = s && s.games > 0 ? `${Math.round((s.wins / s.games) * 100)}%` : "0%";

  if (loading) return <p className="text-sm text-muted-foreground">Loading profile…</p>;

  return (
    <div className="space-y-5">
      <ProfileHeader address={address} profile={data?.profile ?? null} isYou={isYou} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="Games" value={s ? String(s.games) : "0"} />
        <Stat label="Wins" value={s ? String(s.wins) : "0"} />
        <Stat label="Win rate" value={winRate} />
        <Stat label="Volume" value={s ? s.volume : "0"} />
        <Stat label="Won" value={s ? s.earnings : "0"} />
      </div>

      <AchievementBadges stats={s ?? null} />

      <div className="space-y-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Recent games</h2>
        <RecentGamesList games={data?.recent ?? []} />
      </div>
    </div>
  );
}
