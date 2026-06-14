"use client";

import Link from "next/link";
import { useArenas } from "../../hooks/useArenas";
import { ArenaCard } from "../../components/ArenaCard";
import { ConnectButton } from "../../components/ConnectButton";

export default function ArenasPage() {
  const { arenas, loading } = useArenas();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-yellow-400">Arenas</h1>
        <ConnectButton />
      </div>

      <Link
        href="/create"
        className="rounded-xl bg-yellow-400 px-4 py-3 text-center font-semibold text-neutral-950"
      >
        + Create arena
      </Link>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : arenas.length === 0 ? (
        <p className="text-sm text-neutral-500">No arenas yet — create the first one.</p>
      ) : (
        <div className="space-y-3">
          {arenas.map((a) => (
            <ArenaCard key={a.id.toString()} arena={a} />
          ))}
        </div>
      )}
    </main>
  );
}
