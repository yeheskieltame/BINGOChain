"use client";

import { useEffect, useState } from "react";
import { Countdown } from "./Countdown";
import { Badge, type BadgeProps } from "./ui/badge";
import { Player } from "./Player";
import { getCompetitionLeaderboard, type Competition, type LeaderboardRow } from "../lib/api";
import { useProfiles } from "../hooks/useProfiles";
import { cn } from "../lib/utils";

const MEDAL = ["🥇", "🥈", "🥉"];

const STATUS_BADGE: Record<Competition["status"], BadgeProps["variant"]> = {
  live: "open",
  upcoming: "outline",
  past: "settled",
};

/// One cup in the multi-event grid: title, status, countdown, prize, and a live
/// top-3 preview of its own leaderboard. Selecting it opens the full standings.
export function CupEventCard({
  event,
  selected,
  onSelect,
}: {
  event: Competition;
  selected: boolean;
  onSelect: () => void;
}) {
  const [top, setTop] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    let on = true;
    getCompetitionLeaderboard(event.id)
      .then((r) => on && setTop(r.slice(0, 3)))
      .catch(() => on && setTop([]));
    return () => {
      on = false;
    };
  }, [event.id]);

  const profiles = useProfiles((top ?? []).map((r) => r.address));

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "group glass relative flex w-full flex-col gap-3 overflow-hidden rounded-2xl p-5 text-left transition-all duration-300 hover:-translate-y-1 hover:border-neon/40 hover:shadow-glow",
        selected && "border-neon/50 shadow-glow",
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-neon/10 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
      />

      <div className="relative flex items-start justify-between gap-3">
        <h3 className="font-anton text-lg uppercase leading-tight text-cream">{event.title}</h3>
        <Badge variant={STATUS_BADGE[event.status]} dot={event.status === "live"}>
          {event.status}
        </Badge>
      </div>

      <div className="relative flex items-center justify-between text-xs">
        <span className="text-muted-foreground">
          {event.status === "live" ? "Ends in" : event.status === "upcoming" ? "Starts" : "Ended"}
        </span>
        {event.status === "live" ? (
          <Countdown to={event.endsAt} />
        ) : (
          <span className="font-mono text-muted-foreground">
            {new Date(event.status === "upcoming" ? event.startsAt : event.endsAt).toLocaleDateString()}
          </span>
        )}
      </div>

      {event.prizePerWinner && (
        <p className="relative text-xs text-muted-foreground">
          Top <span className="text-cream">{event.topN}</span> win{" "}
          <span className="text-neon">
            {event.prizePerWinner} {event.token}
          </span>{" "}
          each
        </p>
      )}

      <div className="relative mt-1 space-y-1.5 border-t border-white/[0.06] pt-3">
        {top === null ? (
          <p className="text-xs text-muted-foreground">Loading standings…</p>
        ) : top.length === 0 ? (
          <p className="text-xs text-muted-foreground">No entries yet.</p>
        ) : (
          top.map((r, i) => {
            const prof = profiles[r.address.toLowerCase()];
            return (
              <div key={r.address} className="flex items-center justify-between gap-2 text-xs">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="w-4 shrink-0 text-center">{MEDAL[i] ?? i + 1}</span>
                  <Player address={r.address} name={prof?.name ?? r.name ?? undefined} imageUrl={prof?.avatarUrl} size="sm" />
                </span>
                <span className="shrink-0 font-mono text-gold-300">{r.volume}</span>
              </div>
            );
          })
        )}
      </div>

      <span className="relative mt-1 font-mono text-[11px] uppercase tracking-wider text-neon/70">
        {selected ? "Showing full board ↓" : "View full board →"}
      </span>
    </button>
  );
}
