"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID } from "../../../lib/bingo";
import { commitment, randomBoard, randomSalt, completedLines } from "../../../lib/board";
import { formatAmount } from "../../../lib/format";
import { useArena } from "../../../hooks/useArena";
import { useToken } from "../../../hooks/useToken";
import { tokenInfo } from "../../../components/ArenaCard";
import { BoardGrid } from "../../../components/BoardGrid";
import { NumberPad } from "../../../components/NumberPad";
import { ConnectButton } from "../../../components/ConnectButton";

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
    return <main className="mx-auto max-w-md px-5 py-10 text-neutral-400">Loading arena #{id.toString()}…</main>;
  }

  const state = Number(arena.state);
  const STATES = ["Created", "Committed", "Playing", "Revealing", "Settled", "Cancelled"];
  const myTurn = state === 1 || state === 2 ? players[Number(arena.turnIndex)]?.toLowerCase() === address?.toLowerCase() : false;
  const lines = mine ? completedLines(mine.board, calledSet) : 0;

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-yellow-400">Arena #{id.toString()}</h1>
        <ConnectButton />
      </div>

      <div className="flex justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-3 text-sm">
        <span>{STATES[state]}</span>
        <span className="text-neutral-400">
          {arena.joinedCount}/{arena.maxPlayers} · {t ? formatAmount(arena.stake, t.decimals) : ""} {t?.symbol}
        </span>
      </div>

      {/* Created: join */}
      {state === 0 && !joined && (
        <button type="button" onClick={() => run(join)} disabled={busy || !address} className="rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50">
          {busy ? "Joining…" : "Generate board + join"}
        </button>
      )}
      {state === 0 && joined && <p className="text-sm text-emerald-400">Joined — waiting for the arena to fill.</p>}

      {/* Playing: board progress + call + claim */}
      {(state === 1 || state === 2) && (
        <>
          {mine && (
            <div className="space-y-2">
              <p className="text-sm text-neutral-400">Your board · {lines}/5 lines</p>
              <BoardGrid board={mine.board} called={calledSet} />
            </div>
          )}
          <div className="space-y-2">
            <p className="text-sm text-neutral-400">{myTurn ? "Your turn — call a number" : "Called numbers"}</p>
            <NumberPad called={calledSet} disabled={busy || !myTurn} onCall={(n) => run(() => write("callNumber", [id, n]))} />
          </div>
          {joined && (
            <button type="button" onClick={() => run(() => write("claimBingo", [id]))} disabled={busy} className="rounded-xl border border-yellow-400 px-4 py-3 font-semibold text-yellow-400 disabled:opacity-50">
              Claim BINGO
            </button>
          )}
        </>
      )}

      {/* Revealing: reveal + settle */}
      {state === 3 && (
        <>
          {mine ? (
            <button type="button" onClick={() => run(() => write("revealBoard", [id, mine.board, mine.salt]))} disabled={busy} className="rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50">
              Reveal my board
            </button>
          ) : (
            <p className="text-sm text-neutral-500">No saved board on this device to reveal.</p>
          )}
          <button type="button" onClick={() => run(() => write("settle", [id]))} disabled={busy} className="rounded-xl border border-neutral-700 px-4 py-3 font-semibold disabled:opacity-50">
            Settle
          </button>
        </>
      )}

      {/* Settled / Cancelled: withdraw */}
      {(state === 4 || state === 5) && (
        <>
          <p className="text-sm text-neutral-400">
            {state === 4 ? "Settled." : "Cancelled."} Your balance: {t ? formatAmount(earnings.data ?? 0n, t.decimals) : "0"} {t?.symbol}
          </p>
          {(earnings.data ?? 0n) > 0n && (
            <button type="button" onClick={() => run(() => write("withdraw", [token]))} disabled={busy} className="rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50">
              Withdraw
            </button>
          )}
        </>
      )}
    </main>
  );
}
