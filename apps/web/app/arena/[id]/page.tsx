"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { erc20Abi, maxUint256, parseEther } from "viem";
import { useAccount, useReadContract, useSendTransaction, useWriteContract } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID } from "../../../lib/bingo";
import { commitment, randomBoard, randomSalt, completedLines } from "../../../lib/board";
import { gameWrite, gameSweep } from "../../../lib/gameWallet";
import { useGameWallet } from "../../../hooks/useGameWallet";
import { formatAmount, shortAddress } from "../../../lib/format";
import { cn } from "../../../lib/utils";
import { useArena } from "../../../hooks/useArena";
import { useToken } from "../../../hooks/useToken";
import { tokenInfo } from "../../../components/ArenaCard";
import { BoardGrid } from "../../../components/BoardGrid";
import { BoardBuilder } from "../../../components/BoardBuilder";
import { BingoMeter } from "../../../components/BingoMeter";
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
  // The board the player builds before joining: 25 cells, null = empty. Numbers
  // are dragged/tapped in from the tray; complete once every cell is filled.
  const [draft, setDraft] = useState<(number | null)[]>(() => Array(25).fill(null));
  const boardComplete = draft.every((n) => n !== null);
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();

  const token = (arena?.token ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const t = tokenInfo(token);
  const { allowance, approve } = useToken(token);

  // Smooth play: an in-browser game wallet plays auto-signed (no popup per turn).
  // It's the effective player once it has joined; otherwise the connected wallet
  // is. `me` is whichever address is the player; `smooth` means the game wallet.
  const gw = useGameWallet(token);
  const gameAddr = gw.gameAddr;
  const smoothJoined = !!gameAddr && players.some((p) => p.toLowerCase() === gameAddr.toLowerCase());
  const mainJoined = !!address && players.some((p) => p.toLowerCase() === address.toLowerCase());
  const smooth = smoothJoined;
  const me = (smooth && gameAddr ? gameAddr : address) as `0x${string}` | undefined;

  const calledSet = useMemo(() => new Set(calls), [calls]);
  const mine = me ? loadBoard(id.toString(), me) : null;
  const joined = smoothJoined || mainJoined;

  const earnings = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "earningsOf",
    args: me ? [me, token] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!me && !!arena },
  });

  // The board commitment stored on-chain for this player — used to detect a
  // saved board that no longer matches it (overwritten), which can never reveal.
  const myCommit = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "boardCommitOf",
    args: me ? [id, me] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!me && !!arena },
  });
  const onchainCommit = typeof myCommit.data === "string" ? myCommit.data : undefined;
  const hasCommit = !!onchainCommit && !/^0x0+$/.test(onchainCommit);
  const savedMismatch =
    !!mine && hasCommit && commitment(mine.board, mine.salt).toLowerCase() !== onchainCommit!.toLowerCase();

  const revealedMe = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "hasRevealed",
    args: me ? [id, me] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!me && !!arena, refetchInterval: 3000 },
  });
  const iRevealed = revealedMe.data === true;

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

  async function join(board: number[]) {
    if (!address || !arena) return;
    // Reuse the board + salt already sealed for this arena if one exists, so a
    // re-submit (double click, retry, or rejoining a stale view) can NEVER
    // replace the salt that was committed on-chain. Overwriting it was the bug
    // that made reveal fail later with CommitMismatch. Otherwise seal this board
    // with a fresh salt and persist it before committing so it is never lost.
    const sealed = loadBoard(id.toString(), address) ?? { board, salt: randomSalt() };
    saveBoard(id.toString(), address, sealed);
    if (allowance < arena.stake) await approve();
    await writeContractAsync({
      abi: bingoAbi,
      address: BINGO_ADDRESS,
      functionName: "commitBoard",
      args: [id, commitment(sealed.board, sealed.salt)],
      chainId: CHAIN_ID,
    });
  }

  // Smooth join: fund the game wallet once from the main wallet (stake + gas),
  // then the game wallet approves + commits — and from there plays auto-signed.
  async function joinSmooth(board: number[]) {
    if (!address || !arena || !gameAddr) return;
    if (gw.gas < parseEther("0.25")) {
      await sendTransactionAsync({ to: gameAddr, value: parseEther("0.3") });
    }
    if (gw.token < arena.stake) {
      await writeContractAsync({
        abi: erc20Abi,
        address: token,
        functionName: "transfer",
        args: [gameAddr, arena.stake - gw.token],
        chainId: CHAIN_ID,
      });
    }
    await new Promise((r) => setTimeout(r, 5000));
    await gw.refetch();
    const sealed = loadBoard(id.toString(), gameAddr) ?? { board, salt: randomSalt() };
    saveBoard(id.toString(), gameAddr, sealed);
    await gameWrite(address, { address: token, abi: erc20Abi, functionName: "approve", args: [BINGO_ADDRESS, maxUint256] });
    await gameWrite(address, {
      address: BINGO_ADDRESS,
      abi: bingoAbi,
      functionName: "commitBoard",
      args: [id, commitment(sealed.board, sealed.salt)],
    });
  }

  async function sweepGame() {
    if (!address) return;
    await gameSweep(address, address, token);
    await gw.refetch();
  }

  // Writes route through the game wallet (auto-signed, no popup) once playing
  // smoothly; otherwise through the connected wallet.
  const write = (fn: string, args: readonly unknown[]) =>
    smooth && address
      ? gameWrite(address, { address: BINGO_ADDRESS, abi: bingoAbi, functionName: fn, args })
      : writeContractAsync(
          { abi: bingoAbi, address: BINGO_ADDRESS, functionName: fn, args, chainId: CHAIN_ID } as Parameters<
            typeof writeContractAsync
          >[0],
        );

  if (!arena) {
    return <main className="mx-auto max-w-2xl px-5 py-10 text-muted-foreground">Loading arena #{id.toString()}…</main>;
  }

  const state = Number(arena.state);
  const STATES = ["Created", "Committed", "Playing", "Revealing", "Settled", "Cancelled"];
  const myTurn = state === 1 || state === 2 ? players[Number(arena.turnIndex)]?.toLowerCase() === me?.toLowerCase() : false;
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

      {!!gameAddr && (gw.gas > 0n || gw.token > 0n) && (
        <div className="glass flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 text-xs">
          <span className="font-mono text-muted-foreground">
            Game wallet: {formatAmount(gw.token, t?.decimals ?? 18, 2)} {t?.symbol} · {formatAmount(gw.gas, 18, 3)} CELO
          </span>
          <Button variant="ghost" size="sm" onClick={() => run(sweepGame)} disabled={busy}>
            Sweep to my wallet
          </Button>
        </div>
      )}

      {players.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Players · {players.length}/{arena.maxPlayers}
          </p>
          <div className="flex flex-wrap gap-2">
            {players.map((p, i) => {
              const isTurn = (state === 1 || state === 2) && Number(arena.turnIndex) === i;
              const isMe = p.toLowerCase() === me?.toLowerCase();
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

      {/* Created: build your board, then join */}
      {state === 0 && !joined && (
        <div className="glass space-y-4 rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-anton text-base uppercase text-cream">Build your board</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Drag numbers into the grid (or tap a number, then a cell). Numbers are called 1-25 in turn, so place them to complete lines early.
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" size="sm" onClick={() => setDraft(randomBoard())} disabled={busy}>
                Auto-fill
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setDraft(Array(25).fill(null))} disabled={busy}>
                Clear
              </Button>
            </div>
          </div>
          <BoardBuilder value={draft} onChange={setDraft} disabled={busy} />
          <Button
            onClick={() => boardComplete && run(() => join(draft as number[]))}
            disabled={busy || !address || !boardComplete}
            size="lg"
            className="w-full"
          >
            {busy
              ? "Joining…"
              : boardComplete
                ? "Join with this board"
                : `Place all 25 numbers (${draft.filter((n) => n !== null).length}/25)`}
          </Button>
          {boardComplete && (
            <div className="space-y-1.5 border-t border-white/[0.06] pt-3">
              <Button
                variant="secondary"
                onClick={() => run(() => joinSmooth(draft as number[]))}
                disabled={busy || !address}
                size="lg"
                className="w-full"
              >
                {busy ? "Setting up smooth play…" : "Join smoothly — no popups per turn"}
              </Button>
              <p className="text-[0.7rem] leading-relaxed text-muted-foreground">
                Funds an in-browser game wallet once (stake + a little CELO), then every turn auto-signs with no wallet
                popup. Beta: try a small stake; sweep funds back anytime from the bar above.
              </p>
            </div>
          )}
        </div>
      )}
      {state === 0 && joined && <p className="text-sm text-state-open">Joined — waiting for the arena to fill.</p>}

      {/* Playing: board progress + call + claim */}
      {(state === 1 || state === 2) && (
        <>
          <div className="grid gap-5 sm:grid-cols-2">
            {mine && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Your board · <span className="text-gold-300">{lines}/5</span> lines
                </p>
                <BoardGrid board={mine.board} called={calledSet} lastCalled={lastCalled} />
                <BingoMeter lines={lines} />
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{myTurn ? "Your turn to call a number" : "Called numbers"}</p>
              <NumberPad called={calledSet} disabled={busy || !myTurn} onCall={(n) => run(() => write("callNumber", [id, n]))} lastCalled={lastCalled} />
            </div>
          </div>
          {joined &&
            (lines >= 5 ? (
              <Button
                onClick={() => run(() => write("claimBingo", [id]))}
                disabled={busy}
                size="lg"
                className="w-full animate-pulse bg-primary text-primary-foreground shadow-glow hover:bg-gold-500"
              >
                {busy ? "Claiming…" : "Claim BINGO!"}
              </Button>
            ) : (
              <p className="text-center text-xs text-muted-foreground">Complete 5 lines (B-I-N-G-O) to claim.</p>
            ))}
        </>
      )}

      {/* Revealing: reveal + settle */}
      {state === 3 && (
        <>
          {iRevealed ? (
            <p className="rounded-xl border border-state-open/30 bg-state-open/10 p-3 text-sm text-state-open">
              Board revealed. Waiting for all players to reveal or the window to close, then anyone can settle.
            </p>
          ) : savedMismatch ? (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
              Your saved board for this arena doesn&apos;t match what you committed on-chain, so it can&apos;t be
              revealed (the saved copy was overwritten on this device). Nothing to do here; the arena settles
              automatically once the reveal window ends.
            </p>
          ) : mine ? (
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
