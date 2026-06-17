"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID } from "../../../lib/bingo";
import { commitment, randomBoard, randomSalt, completedLines } from "../../../lib/board";
import { formatAmount, shortAddress } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { useArena } from "../../../hooks/useArena";
import { useToken } from "../../../hooks/useToken";
import { tokenInfo } from "../../../components/ArenaCard";
import { BoardGrid } from "../../../components/BoardGrid";
import { BoardBuilder } from "../../../components/BoardBuilder";
import { NumberPad } from "../../../components/NumberPad";
import { ConnectButton } from "../../../components/ConnectButton";
import { PlayerAvatar } from "../../../components/PlayerAvatar";
import { useProfiles } from "../../../hooks/useProfiles";
import { Button } from "../../../components/ui/button";
import { Badge, type BadgeProps } from "../../../components/ui/badge";
import { BackButton } from "../../../components/BackButton";
import { PageHeader } from "../../../components/PageHeader";
import { ArenaResult } from "../../../components/ArenaResult";
import { ShareButton } from "../../../components/ShareButton";

type Saved = { board: number[]; salt: `0x${string}` };

function loadBoard(id: string, who: string): Saved | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(`bingo:${id}:${who.toLowerCase()}`);
  return raw ? (JSON.parse(raw) as Saved) : null;
}
function saveBoard(id: string, who: string, data: Saved) {
  localStorage.setItem(`bingo:${id}:${who.toLowerCase()}`, JSON.stringify(data));
}

export default function ArenaPage() {
  const id = BigInt(useParams<{ id: string }>().id);
  const { address } = useAccount();
  const { arena, players, calls, refetch } = useArena(id);
  const profiles = useProfiles(players);
  const [busy, setBusy] = useState(false);
  const { writeContractAsync } = useWriteContract();

  const token = (arena?.token ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const t = tokenInfo(token);
  const { allowance, approve } = useToken(token);

  const calledSet = useMemo(() => new Set(calls), [calls]);
  const mine = address ? loadBoard(id.toString(), address) : null;
  const joined = !!address && players.some((p) => p.toLowerCase() === address.toLowerCase());

  const earnings = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "earningsOf",
    args: address ? [address, token] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address && !!arena },
  });

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await new Promise((r) => setTimeout(r, 4000));
      refetch();
      earnings.refetch();
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    if (!address || !arena) return;
    const board = randomBoard();
    const salt = randomSalt();
    saveBoard(id.toString(), address, { board, salt });
    if (allowance < arena.stake) await approve();
    await writeContractAsync({
      abi: bingoAbi,
      address: BINGO_ADDRESS,
      functionName: "commitBoard",
      args: [id, commitment(board, salt)],
      chainId: CHAIN_ID,
    });
  }

  const write = (fn: string, args: readonly unknown[]) =>
    writeContractAsync(
      { abi: bingoAbi, address: BINGO_ADDRESS, functionName: fn, args, chainId: CHAIN_ID } as Parameters<
        typeof writeContractAsync
      >[0],
    );

  if (!arena) {
    return <main className="mx-auto max-w-2xl px-5 py-10 text-muted-foreground">Loading arena #{id.toString()}…</main>;
  }

  const state = Number(arena.state);
  const STATES = ["Created", "Committed", "Playing", "Revealing", "Settled", "Cancelled"];
  const myTurn = state === 1 || state === 2 ? players[Number(arena.turnIndex)]?.toLowerCase() === address?.toLowerCase() : false;
  const lines = mine ? completedLines(mine.board, calledSet) : 0;
  const lastCalled = calls.length ? calls[calls.length - 1] : undefined;
  const STATE_BADGE: BadgeProps["variant"][] = ["open", "full", "playing", "revealing", "settled", "cancelled"];

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-5 px-5 py-10 md:px-6">
      <BackButton />
      <PageHeader
        eyebrow="Live arena"
        title={
          <>
            Arena <span className="font-mono text-neon">#{id.toString()}</span>
          </>
        }
        actions={
          <>
            <ShareButton title={`BINGOChain · Arena #${id.toString()}`} />
            {/* Connect lives in the TopNav on desktop */}
            <div className="md:hidden">
              <ConnectButton />
            </div>
          </>
        }
      />

      <div className="glass flex items-center justify-between rounded-xl p-3.5 text-sm">
        <Badge variant={STATE_BADGE[state] ?? "open"} dot={state === 1 || state === 2}>
          {STATES[state]}
        </Badge>
        <span className="font-mono text-muted-foreground">
          {arena.joinedCount}/{arena.maxPlayers} · {t ? formatAmount(arena.stake, t.decimals) : ""} {t?.symbol}
        </span>
      </div>

      {players.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Players · {players.length}/{arena.maxPlayers}
          </p>
          <div className="flex flex-wrap gap-2">
            {players.map((p, i) => {
              const isTurn = (state === 1 || state === 2) && Number(arena.turnIndex) === i;
              const isMe = p.toLowerCase() === address?.toLowerCase();
              const prof = profiles[p.toLowerCase()];
              return (
                <div
                  key={p}
                  className={cn(
                    "glass flex items-center gap-2 rounded-full py-1 pl-1 pr-3",
                    isTurn && "ring-1 ring-gold-400/60",
                  )}
                >
                  <PlayerAvatar address={p} imageUrl={prof?.avatarUrl} size={22} />
                  <span className={prof?.name ? "text-xs font-medium text-foreground" : "font-mono text-xs text-foreground"}>
                    {prof?.name ?? shortAddress(p)}
                    {isMe && <span className="text-gold-300"> · you</span>}
                  </span>
                  {isTurn && <span className="size-1.5 animate-pulse rounded-full bg-gold-400" />}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Created: join */}
      {state === 0 && !joined && (
        <Button onClick={() => run(join)} disabled={busy || !address} size="lg">
          {busy ? "Joining…" : "Generate board + join"}
        </Button>
      )}
      {state === 0 && joined && <p className="text-sm text-state-open">Joined — waiting for the arena to fill.</p>}

      {/* Playing: board progress + call + claim */}
      {(state === 1 || state === 2) && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {mine && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Your board · <span className="text-gold-300">{lines}/5</span> lines
                </p>
                <BoardGrid board={mine.board} called={calledSet} lastCalled={lastCalled} />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{myTurn ? "Your turn — call a number" : "Called numbers"}</p>
              <NumberPad called={calledSet} disabled={busy || !myTurn} onCall={(n) => run(() => write("callNumber", [id, n]))} lastCalled={lastCalled} />
            </div>
          </div>
          {joined && (
            <Button variant="outline" onClick={() => run(() => write("claimBingo", [id]))} disabled={busy} size="lg" className="border-gold-400/50 text-gold-300 hover:bg-gold-400/10">
              Claim BINGO
            </Button>
          )}
        </>
      )}

      {/* Revealing: reveal + settle */}
      {state === 3 && (
        <>
          {mine ? (
            <Button onClick={() => run(() => write("revealBoard", [id, mine.board, mine.salt]))} disabled={busy} size="lg">
              Reveal my board
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">No saved board on this device to reveal.</p>
          )}
          <Button variant="secondary" onClick={() => run(() => write("settle", [id]))} disabled={busy} size="lg">
            Settle
          </Button>
          <ArenaResult arenaId={id.toString()} called={calledSet} />
        </>
      )}

      {/* Settled / Cancelled: withdraw */}
      {(state === 4 || state === 5) && (
        <>
          <p className="text-sm text-muted-foreground">
            {state === 4 ? "Settled." : "Cancelled."} Your balance: {t ? formatAmount(earnings.data ?? 0n, t.decimals) : "0"} {t?.symbol}
          </p>
          {(earnings.data ?? 0n) > 0n && (
            <Button onClick={() => run(() => write("withdraw", [token]))} disabled={busy} size="lg">
              Withdraw
            </Button>
          )}
          <ArenaResult arenaId={id.toString()} called={calledSet} />
        </>
      )}
    </main>
  );
}
