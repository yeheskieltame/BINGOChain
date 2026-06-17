"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useArenas } from "../../hooks/useArenas";
import { ArenaCard, tokenInfo } from "../../components/ArenaCard";
import { ConnectButton } from "../../components/ConnectButton";
import { PageHeader } from "../../components/PageHeader";
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

const PAGE_SIZE = 9;

export default function ArenasPage() {
  const { arenas, loading, error } = useArenas();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("open");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const active = FILTERS.find((f) => f.key === filter)!;

  const term = q.trim().toLowerCase();
  const sorted = [...arenas]
    .sort((a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9) || (a.id > b.id ? -1 : 1))
    .filter((a) => active.match(a.state))
    .filter(
      (a) => !term || a.id.toString().includes(term) || (tokenInfo(a.token)?.symbol ?? "").toLowerCase().includes(term),
    );
  const openCount = arenas.filter((a) => a.state === "created").length;

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const pageItems = sorted.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  // Reset to the first page whenever the filter or search term changes.
  useEffect(() => setPage(0), [filter, term]);

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-7 px-5 py-10 md:px-6">
      <PageHeader
        eyebrow="Onchain bingo lobby"
        title="Arenas"
        accent="live"
        subtitle={
          <>
            Sealed boards, verifiable winners. Claim a seat, stake <span className="text-neon">$LANCE</span>, and race
            to call the winning line.
          </>
        }
        actions={
          <>
            <Button asChild size="lg" className="hidden md:inline-flex md:px-7">
              <Link href="/create">+ Create arena</Link>
            </Button>
            <div className="md:hidden">
              <ConnectButton />
            </div>
          </>
        }
      />

      {/* Mobile primary actions (the create button lives in the header on desktop). */}
      <div className="grid grid-cols-2 gap-3 md:hidden">
        <Button asChild size="lg">
          <Link href="/create">+ Create arena</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/profile">Profile</Link>
        </Button>
      </div>

      {/* Glass control bar: search + state filters. */}
      <div className="glass flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:items-center">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by arena # or token…"
          inputMode="search"
          className="border-0 bg-white/[0.03] sm:max-w-xs"
        />
        <div className="flex items-center gap-1.5 sm:ml-auto">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-full px-3.5 py-1.5 font-mono text-xs uppercase tracking-wider transition-colors",
                filter === f.key
                  ? "bg-neon/15 text-neon ring-1 ring-neon/30"
                  : "text-muted-foreground hover:bg-white/5 hover:text-cream",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && arenas.length > 0 && (
        <p className="-mt-3 text-right font-mono text-xs text-muted-foreground">
          {openCount} open · {arenas.length} recent
        </p>
      )}

      {error ? (
        <p className="text-sm text-destructive">Couldn’t load arenas: {error}</p>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[168px] w-full rounded-2xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="glass mx-auto flex w-full max-w-md flex-col items-center gap-3 rounded-2xl p-10 text-center">
          <p className="font-anton text-xl uppercase text-cream">
            {arenas.length === 0 ? "No arenas yet" : "Nothing here"}
          </p>
          <p className="text-sm text-muted-foreground">
            {arenas.length === 0 ? "Be the first to open one." : "Try a different filter."}
          </p>
          <Button asChild>
            <Link href="/create">+ Create arena</Link>
          </Button>
          <Link
            href="/how-to-play"
            className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-neon hover:underline"
          >
            New here? How to play →
          </Link>
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((a) => (
              <ArenaCard key={a.id.toString()} arena={a} />
            ))}
          </div>
          {pageCount > 1 && (
            <div className="flex items-center justify-between pt-1">
              <Button variant="secondary" size="sm" disabled={page <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Prev
              </Button>
              <span className="font-mono text-xs text-muted-foreground">
                Page {Math.min(page, pageCount - 1) + 1} / {pageCount}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={page >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
