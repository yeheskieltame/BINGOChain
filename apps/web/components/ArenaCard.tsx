"use client";

import Link from "next/link";
import { TOKENS } from "../lib/bingo";
import { formatAmount } from "../lib/format";
import type { ArenaState, ArenaSummary } from "../hooks/useArenas";
import { Badge, type BadgeProps } from "./ui/badge";

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

  return (
    <Link
      href={`/arena/${arena.id}`}
      className="group glass glass-hover relative block overflow-hidden rounded-xl p-4 transition-transform duration-200 hover:-translate-y-0.5"
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-base font-bold text-foreground">
          Arena <span className="font-mono text-gold-300">#{arena.id.toString()}</span>
        </span>
        <Badge variant={s.variant} dot={live}>
          {s.label}
        </Badge>
      </div>

      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">Stake</p>
          <p className="font-mono text-sm text-foreground">
            {t ? formatAmount(arena.stake, t.decimals) : arena.stake.toString()}{" "}
            <span className="text-muted-foreground">{t?.symbol ?? "token"}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[0.7rem] uppercase tracking-wider text-muted-foreground">Seats</p>
          <p className="font-mono text-sm text-foreground">
            {arena.joinedCount}/{arena.maxPlayers}
          </p>
        </div>
      </div>
    </Link>
  );
}
