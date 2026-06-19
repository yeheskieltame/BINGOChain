"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { erc20Abi, parseEther, parseUnits } from "viem";
import { useAccount, useReadContract, useSendTransaction, useWriteContract } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID } from "../../../lib/bingo";
import { commitment, randomBoard, randomSalt, completedLines } from "../../../lib/board";
import { LANCE_ADDRESS } from "../../../lib/lance";
import { sessionAccount, sessionWrite, sessionFunded, saveGasChoice, GAS_TOKENS, type GasChoice } from "../../../lib/session";
import { isMiniPay, miniPayTx, MINIPAY_ADD_CASH } from "../../../lib/minipay";
import Link from "next/link";
import { formatAmount, shortAddress, profileHref } from "../../../lib/format";
import { cn, errText } from "../../../lib/utils";
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
  const [msg, setMsg] = useState<string | null>(null);
  // The board the player builds before joining: 25 cells, null = empty. Numbers
  // are dragged/tapped in from the tray; complete once every cell is filled.
  const [draft, setDraft] = useState<(number | null)[]>(() => Array(25).fill(null));
  const boardComplete = draft.every((n) => n !== null);
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();

  const token = (arena?.token ?? "0x0000000000000000000000000000000000000000") as `0x${string}`;
  const t = tokenInfo(token);
  const { balance, balanceLoading, allowance, approve, refetch: refetchToken } = useToken(token);

  // Smooth play (no popup per turn): the player authorizes an in-app SESSION KEY
  // on-chain (setSessionKey) that auto-signs every move, gas paid natively. The
  // player stays the on-chain player, so `me` is always the connected wallet.
  const me = address;
  const sessionAddr = useMemo(() => (address ? sessionAccount(address).address : undefined), [address]);
  // MiniPay holds stablecoins (no CELO) and accepts only legacy + feeCurrency txs.
  const [miniPay, setMiniPay] = useState(false);
  useEffect(() => setMiniPay(isMiniPay()), []);

  const calledSet = useMemo(() => new Set(calls), [calls]);
  const mine = me ? loadBoard(id.toString(), me) : null;
  const joined = !!address && players.some((p) => p.toLowerCase() === address.toLowerCase());

  // Session key authorized on-chain for this player + funded with gas?
  const onchainSession = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "sessionKeyOf",
    args: address ? [address] : undefined,
    chainId: CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 5000 },
  });
  const sessionAuthorized =
    !!sessionAddr &&
    typeof onchainSession.data === "string" &&
    onchainSession.data.toLowerCase() === sessionAddr.toLowerCase();
  const [funded, setFunded] = useState(false);
  useEffect(() => {
    if (!address) return;
    let on = true;
    const f = () => sessionFunded(address).then((v) => on && setFunded(v)).catch(() => {});
    f();
    const iv = setInterval(f, 5000);
    return () => {
      on = false;
      clearInterval(iv);
    };
  }, [address]);
  const smooth = sessionAuthorized && funded;

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
    setMsg(null);
    try {
      await fn();
      await new Promise((r) => setTimeout(r, 4000));
      refetch();
      refetchToken();
      earnings.refetch();
    } catch (e) {
      const m = errText(e);
      setMsg(/reject|denied|user refus/i.test(m) ? "Cancelled in your wallet." : m.slice(0, 220));
    } finally {
      setBusy(false);
    }
  }

  async function join(board: number[]) {
    if (!address || !arena) return;
    // Pre-flight the stake balance so we never fire approve + commitBoard when the
    // wallet can't cover the stake. Without this the approve goes through (costing
    // gas) and commitBoard then reverts on its internal transferFrom, which looked
    // like an unexplained "join failed and bounced back". Bail with a clear message.
    if (balance < arena.stake) {
      const need = t ? `${formatAmount(arena.stake, t.decimals)} ${t.symbol}` : "the stake";
      const have = t ? `${formatAmount(balance, t.decimals)} ${t.symbol}` : "less than that";
      setMsg(`Not enough ${t?.symbol ?? "balance"} to join. You need ${need} but have ${have}. Nothing was sent — top up and try again.`);
      return;
    }
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
      ...miniPayTx(),
    } as Parameters<typeof writeContractAsync>[0]);
  }

  // Enable smooth play: authorize the in-app session key on-chain (one signature),
  // then fund it with a little gas in the currency the player picked (CELO native,
  // or cUSD / USDT via Celo fee abstraction). From then on every turn auto-signs
  // with no popup, gas paid natively in that currency.
  async function enableSmooth(choice: GasChoice) {
    if (!address || !sessionAddr) return;
    saveGasChoice(address, choice);
    if (!sessionAuthorized) {
      await writeContractAsync({
        abi: bingoAbi,
        address: BINGO_ADDRESS,
        functionName: "setSessionKey",
        args: [sessionAddr],
        chainId: CHAIN_ID,
        ...miniPayTx(),
      } as Parameters<typeof writeContractAsync>[0]);
    }
    const opt = GAS_TOKENS[choice];
    if (opt.erc20) {
      await writeContractAsync({
        abi: erc20Abi,
        address: opt.erc20,
        functionName: "transfer",
        args: [sessionAddr, parseUnits(opt.fund, opt.decimals)],
        chainId: CHAIN_ID,
        ...miniPayTx(),
      } as Parameters<typeof writeContractAsync>[0]);
    } else {
      await sendTransactionAsync({ to: sessionAddr, value: parseEther(opt.fund) });
    }
    await new Promise((r) => setTimeout(r, 4000));
    await sessionFunded(address).then(setFunded).catch(() => {});
    onchainSession.refetch();
  }

  async function revokeSmooth() {
    if (!address) return;
    await writeContractAsync({
      abi: bingoAbi,
      address: BINGO_ADDRESS,
      functionName: "setSessionKey",
      args: ["0x0000000000000000000000000000000000000000"],
      chainId: CHAIN_ID,
      ...miniPayTx(),
    } as Parameters<typeof writeContractAsync>[0]);
    onchainSession.refetch();
  }

  const walletWrite = (fn: string, args: readonly unknown[]) =>
    writeContractAsync(
      { abi: bingoAbi, address: BINGO_ADDRESS, functionName: fn, args, chainId: CHAIN_ID, ...miniPayTx() } as Parameters<
        typeof writeContractAsync
      >[0],
    );

  // Writes route through the session key (auto-signed, no popup, native gas) when
  // smooth play is active; otherwise through the connected wallet. If the session
  // key runs out of gas mid-game, fall back to the connected wallet (one popup)
  // so the turn still goes through instead of hard-stopping on a sequencer error.
  const write = async (fn: string, args: readonly unknown[]) => {
    if (smooth && address) {
      try {
        return await sessionWrite(address, fn, args);
      } catch (e) {
        if (/insufficient funds|insufficient balance|forwarding_sequencer|exceeds .*balance/i.test(errText(e))) {
          setMsg("Smooth play ran low on network fees. Confirm this move in your wallet.");
          return await walletWrite(fn, args);
        }
        throw e;
      }
    }
    return walletWrite(fn, args);
  };

  if (!arena) {
    return <main className="mx-auto max-w-2xl px-5 py-10 text-muted-foreground">Loading arena #{id.toString()}…</main>;
  }

  const state = Number(arena.state);
  const STATES = ["Created", "Committed", "Playing", "Revealing", "Settled", "Cancelled"];
  // Pre-flight: does the connected wallet hold enough stake token to join? Held
  // back while the balance is still loading so we never flash a false "not enough".
  const insufficientStake = !!address && !balanceLoading && balance < arena.stake;
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

      {address && state < 4 && (
        <div className="glass flex flex-wrap items-center justify-between gap-2 rounded-xl p-3 text-xs">
          {smooth ? (
            <>
              <span className="flex items-center gap-1.5 font-mono text-state-open">
                <span className="size-1.5 rounded-full bg-state-open" /> Smooth play on · turns auto-sign, no popup
              </span>
              <Button variant="ghost" size="sm" onClick={() => run(revokeSmooth)} disabled={busy}>
                Turn off
              </Button>
            </>
          ) : (
            <div className="flex w-full flex-col gap-2">
              <span className="font-mono text-muted-foreground">
                Smooth play: authorize once, then every turn auto-signs with no popup. Pick the currency to pay network fees in:
              </span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(GAS_TOKENS) as GasChoice[])
                  // MiniPay holds stablecoins, not CELO, so do not offer paying gas in CELO there.
                  .filter((c) => !(miniPay && c === "CELO"))
                  .map((c) => (
                    <Button
                      key={c}
                      variant="secondary"
                      size="sm"
                      onClick={() => run(() => enableSmooth(c))}
                      disabled={busy || !sessionAddr}
                    >
                      {busy ? "Enabling…" : `Pay in ${c}`}
                    </Button>
                  ))}
              </div>
              {miniPay && (
                <a
                  href={MINIPAY_ADD_CASH}
                  className="font-mono text-[11px] text-neon/80 underline-offset-4 hover:underline"
                >
                  Low on funds? Add cash in MiniPay
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {msg && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{msg}</p>
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
                <Link
                  key={p}
                  href={profileHref(p)}
                  title="View profile"
                  className={cn(
                    "glass flex items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-opacity hover:opacity-80",
                    isTurn && "ring-1 ring-gold-400/60",
                  )}
                >
                  <PlayerAvatar address={p} imageUrl={prof?.avatarUrl} size={22} />
                  <span className={prof?.name ? "text-xs font-medium text-foreground" : "font-mono text-xs text-foreground"}>
                    {prof?.name ?? shortAddress(p)}
                    {isMe && <span className="text-gold-300"> · you</span>}
                  </span>
                  {isTurn && <span className="size-1.5 animate-pulse rounded-full bg-gold-400" />}
                </Link>
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

          {address && t && (
            <div className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-3 py-2 font-mono text-xs">
              <span className="text-muted-foreground">
                Stake{" "}
                <span className="text-cream">
                  {formatAmount(arena.stake, t.decimals)} {t.symbol}
                </span>
              </span>
              <span className={cn("text-muted-foreground", insufficientStake && "font-semibold text-destructive")}>
                You have {balanceLoading ? "…" : formatAmount(balance, t.decimals)} {t.symbol}
              </span>
            </div>
          )}

          {insufficientStake && (
            <div className="space-y-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
              <p>
                Not enough {t?.symbol} to join. This arena needs{" "}
                <span className="font-mono">
                  {t ? formatAmount(arena.stake, t.decimals) : ""} {t?.symbol}
                </span>{" "}
                and you have{" "}
                <span className="font-mono">
                  {t ? formatAmount(balance, t.decimals) : "0"} {t?.symbol}
                </span>
                . Nothing is sent until you can cover the stake.
              </p>
              {token.toLowerCase() === LANCE_ADDRESS.toLowerCase() && (
                <Link
                  href="/profile"
                  className="inline-flex items-center gap-1 font-semibold text-neon underline-offset-4 hover:underline"
                >
                  Get $LANCE →
                </Link>
              )}
            </div>
          )}

          <Button
            onClick={() => boardComplete && run(() => join(draft as number[]))}
            disabled={busy || !address || !boardComplete || balanceLoading || insufficientStake}
            size="lg"
            className="w-full"
          >
            {busy
              ? "Joining…"
              : insufficientStake
                ? `Not enough ${t?.symbol ?? "balance"}`
                : !boardComplete
                  ? `Place all 25 numbers (${draft.filter((n) => n !== null).length}/25)`
                  : "Join with this board"}
          </Button>
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
              {/* Bingo calling is turn-based: only the player whose turn it is can
                  call a number, then the turn passes to the next. Say so plainly so
                  a disabled pad never looks like a bug. */}
              <p className="text-sm">
                {!joined ? (
                  <span className="text-muted-foreground">You are spectating — not a player in this arena.</span>
                ) : myTurn ? (
                  <span className="font-medium text-state-open">Your turn — pick a number to call.</span>
                ) : (
                  <span className="text-muted-foreground">
                    Waiting for{" "}
                    <span className="font-mono text-foreground">{shortAddress(players[Number(arena.turnIndex)] ?? "")}</span> to
                    call…
                  </span>
                )}
              </p>
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
