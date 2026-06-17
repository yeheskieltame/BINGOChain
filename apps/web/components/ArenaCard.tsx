"use client";

import Link from "next/link";
import { TOKENS } from "../lib/bingo";
import { formatAmount } from "../lib/format";
import type { ArenaState, ArenaSummary } from "../hooks/useArenas";
import { Badge, type BadgeProps } from "./ui/badge";
import { cn } from "../lib/utils";

export function tokenInfo(addr: string) {
  return Object.values(TOKENS).find((t) => t.address.toLowerCase() === addr.toLowerCase());
}

const STATE: Record<ArenaState, { label: string; variant: BadgeProps["variant"] }> = {
  created: { label: "Open", variant: "open" },
  committed: { label: "Full", variant: "full" },
  playing: { label: "Playing", variant: "playing" },
  revealing: { label: "Revealing", variant: "revealing" },
  settled: { label: "Settled", variant: "settled" },
  cancelled: { label: "Cancelled", variant: "cancelled" },
};

export function ArenaCard({ arena }: { arena: ArenaSummary }) {
  const t = tokenInfo(arena.token);
  const s = STATE[arena.state] ?? STATE.created;
  const live = arena.state === "playing" || arena.state === "created";
  const seats = Math.min(arena.maxPlayers, 12); // guard the seat bar against odd data

  return (
    <Link
      href={`/arena/${arena.id}`}
      className="group glass animate-fade-rise relative block overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-neon/40 hover:shadow-glow"
    >
      {/* Hairline top-edge highlight for a premium, lit rim. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-neon/50 to-transparent opacity-60"
      />
      {/* Orb glow, top-right — echoes the ruby planet and brightens on hover. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-neon/10 opacity-60 blur-2xl transition-opacity duration-300 group-hover:opacity-100"
      />
      {/* Soft cool glow, bottom-left, for depth. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-12 -left-12 h-28 w-28 rounded-full bg-state-playing/10 opacity-50 blur-2xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <span className="font-anton text-lg uppercase tracking-tight text-cream">
          Arena <span className="font-mono text-neon">#{arena.id.toString()}</span>
        </span>
        <Badge variant={s.variant} dot={live}>
          {s.label}
        </Badge>
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
        <div>
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">Stake</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold leading-none text-cream">
            {t ? formatAmount(arena.stake, t.decimals) : arena.stake.toString()}
            <span className="ml-1 text-xs font-normal text-muted-foreground">{t?.symbol ?? "token"}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[0.6rem] uppercase tracking-[0.22em] text-muted-foreground">Seats</p>
          <p className="mt-1.5 font-mono text-2xl font-semibold leading-none text-cream">
            {arena.joinedCount}
            <span className="text-muted-foreground">/{arena.maxPlayers}</span>
          </p>
        </div>
      </div>

      {/* Seat bar — filled = taken, hollow = open. A small, on-theme tell of how
          close the arena is to locking. */}
      <div className="relative mt-4 flex items-center gap-1.5">
        {Array.from({ length: seats }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              i < arena.joinedCount ? "bg-neon/80" : "bg-white/10",
            )}
          />
        ))}
      </div>
    </Link>
  );
}
