"use client";

import Link from "next/link";
import { TOKENS } from "../lib/bingo";
import { formatAmount } from "../lib/format";
import type { ArenaSummary } from "../hooks/useArenas";

export function tokenInfo(addr: string) {
  return Object.values(TOKENS).find((t) => t.address.toLowerCase() === addr.toLowerCase());
}

export function ArenaCard({ arena }: { arena: ArenaSummary }) {
  const t = tokenInfo(arena.token);
  return (
    <Link
      href={`/arena/${arena.id}`}
      className="block rounded-2xl border border-neutral-800 bg-neutral-900 p-4 transition hover:border-neutral-600"
    >
      <div className="flex items-center justify-between">
        <span className="font-bold text-yellow-400">Arena #{arena.id.toString()}</span>
        <span className="text-xs text-neutral-500">{arena.maxPlayers} seats</span>
      </div>
      <p className="mt-1 text-sm text-neutral-400">
        Stake {t ? formatAmount(arena.stake, t.decimals) : arena.stake.toString()} {t?.symbol ?? "token"}
      </p>
    </Link>
  );
}
