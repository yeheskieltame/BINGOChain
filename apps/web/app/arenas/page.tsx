"use client";

import { useState } from "react";
import Link from "next/link";
import { useArenas } from "../../hooks/useArenas";
import { ArenaCard, tokenInfo } from "../../components/ArenaCard";
import { ConnectButton } from "../../components/ConnectButton";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Skeleton } from "../../components/ui/skeleton";
import { cn } from "../../lib/utils";

// Open/joinable arenas first, then by recency (id desc).
const STATE_ORDER: Record<string, number> = { created: 0, committed: 1, playing: 2, revealing: 3, settled: 4, cancelled: 5 };

const FILTERS = [
  { key: "all", label: "All", match: () => true },
  { key: "open", label: "Open", match: (s: string) => s === "created" },
  { key: "live", label: "Live", match: (s: string) => s === "playing" || s === "committed" },
] as const;

export default function ArenasPage() {
  const { arenas, loading, error } = useArenas();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("open");
  const [q, setQ] = useState("");
  const active = FILTERS.find((f) => f.key === filter)!;

  const term = q.trim().toLowerCase();
  const sorted = [...arenas]
    .sort((a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9) || (a.id > b.id ? -1 : 1))
    .filter((a) => active.match(a.state))
    .filter(
      (a) => !term || a.id.toString().includes(term) || (tokenInfo(a.token)?.symbol ?? "").toLowerCase().includes(term),
    );
  const openCount = arenas.filter((a) => a.state === "created").length;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-foreground">Arenas</h1>
        <ConnectButton />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Button asChild size="lg">
          <Link href="/create">+ Create arena</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/profile">Profile</Link>
        </Button>
      </div>

      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by arena # or token…" inputMode="search" />

      <div className="flex items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              filter === f.key ? "bg-gold-400/15 text-gold-300" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
        {!loading && arenas.length > 0 && (
          <span className="ml-auto font-mono text-xs text-muted-foreground">
            {openCount} open · {arenas.length} recent
          </span>
        )}
      </div>

      {error ? (
        <p className="text-sm text-destructive">Couldn’t load arenas: {error}</p>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[88px] w-full rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="glass flex flex-col items-center gap-3 rounded-2xl p-10 text-center">
          <p className="font-display text-lg font-bold text-foreground">
            {arenas.length === 0 ? "No arenas yet" : "Nothing here"}
          </p>
          <p className="text-sm text-muted-foreground">
            {arenas.length === 0 ? "Be the first to open one." : "Try a different filter."}
          </p>
          <Button asChild>
            <Link href="/create">+ Create arena</Link>
          </Button>
        </div>
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
