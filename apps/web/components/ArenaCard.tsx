"use client";

import Link from "next/link";
import { TOKENS } from "../lib/bingo";
import { formatAmount } from "../lib/format";
import type { ArenaState, ArenaSummary } from "../hooks/useArenas";

export function tokenInfo(addr: string) {
  return Object.values(TOKENS).find((t) => t.address.toLowerCase() === addr.toLowerCase());
}

const STATE_LABEL: Record<ArenaState, { text: string; className: string }> = {
  created: { text: "Open", className: "bg-emerald-500/15 text-emerald-400" },
  committed: { text: "Full", className: "bg-amber-500/15 text-amber-400" },
  playing: { text: "Playing", className: "bg-sky-500/15 text-sky-400" },
  revealing: { text: "Revealing", className: "bg-violet-500/15 text-violet-400" },
  settled: { text: "Settled", className: "bg-neutral-600/20 text-neutral-400" },
  cancelled: { text: "Cancelled", className: "bg-neutral-700/20 text-neutral-500" },
};

export function ArenaCard({ arena }: { arena: ArenaSummary }) {
  const t = tokenInfo(arena.token);
  const badge = STATE_LABEL[arena.state] ?? STATE_LABEL.created;
  return (
    <Link
      href={`/arena/${arena.id}`}
      className="block rounded-2xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-600"
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-yellow-400">Arena #{arena.id.toString()}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${badge.className}`}>{badge.text}</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-sm text-neutral-400">
        <span>
          Stake {t ? formatAmount(arena.stake, t.decimals) : arena.stake.toString()} {t?.symbol ?? "token"}
        </span>
        <span className="text-xs text-neutral-500">
          {arena.joinedCount}/{arena.maxPlayers} seats
        </span>
      </div>
    </Link>
  );
}
