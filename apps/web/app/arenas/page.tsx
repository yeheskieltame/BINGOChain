"use client";

import Link from "next/link";
import { useArenas } from "../../hooks/useArenas";
import { ArenaCard } from "../../components/ArenaCard";
import { ConnectButton } from "../../components/ConnectButton";

// Open/joinable arenas first, then by recency (id desc), so a crowded lobby
// always surfaces the games a player can actually join at the top.
const STATE_ORDER: Record<string, number> = { created: 0, committed: 1, playing: 2, revealing: 3, settled: 4, cancelled: 5 };

export default function ArenasPage() {
  const { arenas, loading, error } = useArenas();

  const sorted = [...arenas].sort(
    (a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9) || (a.id > b.id ? -1 : 1),
  );
  const openCount = arenas.filter((a) => a.state === "created").length;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gold-400">Arenas</h1>
        <ConnectButton />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/create"
          className="rounded-xl bg-gold-400 px-4 py-3 text-center font-semibold text-neutral-950"
        >
          + Create arena
        </Link>
        <Link
          href="/profile"
          className="rounded-xl border border-neutral-700 px-4 py-3 text-center font-semibold text-neutral-300 hover:border-neutral-500"
        >
          $LANCE wallet
        </Link>
      </div>

      {!loading && arenas.length > 0 && (
        <p className="text-xs text-neutral-500">
          {openCount} open · {arenas.length} recent
        </p>
      )}

      {error ? (
        <p className="text-sm text-red-400">Couldn’t load arenas: {error}</p>
      ) : loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : arenas.length === 0 ? (
        <p className="text-sm text-neutral-500">No arenas yet — create the first one.</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((a) => (
            <ArenaCard key={a.id.toString()} arena={a} />
          ))}
        </div>
      )}
    </main>
  );
}
