"use client";

import { Sparkles, Dices, Swords, Medal, Award, Trophy, Coins, Gem, Target, Lock, type LucideIcon } from "lucide-react";
import { achievementsFor } from "../lib/achievements";
import type { PlayerStats } from "../lib/api";
import { cn } from "../lib/utils";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  dices: Dices,
  swords: Swords,
  medal: Medal,
  award: Award,
  trophy: Trophy,
  coins: Coins,
  gem: Gem,
  target: Target,
};

/// Badge grid for a player's achievements — earned ones glow gold, locked ones
/// sit dimmed with a lock so there's always something to chase.
export function AchievementBadges({ stats }: { stats: PlayerStats | null }) {
  const items = achievementsFor(stats);
  const earned = items.filter((a) => a.earned).length;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Achievements</h2>
        <span className="font-mono text-xs text-gold-300">
          {earned}/{items.length}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((a) => {
          const Icon = ICONS[a.icon] ?? Sparkles;
          return (
            <div
              key={a.key}
              title={a.description}
              className={cn(
                "relative flex flex-col items-center gap-1.5 rounded-xl p-3 text-center transition-colors",
                a.earned ? "glass shadow-glow" : "border border-white/[0.05] bg-card/40 opacity-60",
              )}
            >
              <Icon className={cn("size-6", a.earned ? "text-gold-300" : "text-muted-foreground")} />
              <p className={cn("text-[0.7rem] font-semibold leading-tight", a.earned ? "text-foreground" : "text-muted-foreground")}>
                {a.label}
              </p>
              <p className="text-[0.6rem] leading-tight text-muted-foreground">{a.description}</p>
              {!a.earned && <Lock className="absolute right-1.5 top-1.5 size-3 text-muted-foreground" />}
            </div>
          );
        })}
      </div>
    </section>
  );
}
