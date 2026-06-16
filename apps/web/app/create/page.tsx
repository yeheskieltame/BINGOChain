"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decodeEventLog } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID, MIN_PLAYERS, MAX_PLAYERS, MIN_STAKE, TOKENS } from "../../lib/bingo";
import { parseAmount } from "../../lib/format";
import { TokenPicker } from "../../components/TokenPicker";
import { ConnectButton } from "../../components/ConnectButton";

export default function CreatePage() {
  const [tokenKey, setTokenKey] = useState<keyof typeof TOKENS>("LANCE");
  const [stake, setStake] = useState(MIN_STAKE.LANCE);

  // switching token seeds the stake with that token's on-chain minimum
  function pickToken(k: keyof typeof TOKENS) {
    setTokenKey(k);
    setStake(MIN_STAKE[k]);
  }
  const [seats, setSeats] = useState(2);
  const [busy, setBusy] = useState(false);
  const { writeContractAsync } = useWriteContract();
  const client = usePublicClient({ chainId: CHAIN_ID });
  const router = useRouter();

  async function create() {
    if (!client) return;
    setBusy(true);
    try {
      const t = TOKENS[tokenKey];
      const hash = await writeContractAsync({
        abi: bingoAbi,
        address: BINGO_ADDRESS,
        functionName: "createArena",
        args: [t.address as `0x${string}`, seats, parseAmount(stake, t.decimals)],
        chainId: CHAIN_ID,
      });
      const rcpt = await client.waitForTransactionReceipt({ hash });
      let id: bigint | undefined;
      for (const lg of rcpt.logs) {
        try {
          const d = decodeEventLog({ abi: bingoAbi, data: lg.data, topics: lg.topics });
          if (d.eventName === "ArenaCreated") id = (d.args as { arenaId: bigint }).arenaId;
        } catch {
          /* not our event */
        }
      }
      if (id !== undefined) router.push(`/arena/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-yellow-400">New arena</h1>
        <ConnectButton />
      </div>

      <label className="space-y-2">
        <span className="text-sm text-neutral-400">Settlement token</span>
        <TokenPicker value={tokenKey} onChange={pickToken} />
      </label>

      <label className="space-y-2">
        <span className="text-sm text-neutral-400">Entry stake ({TOKENS[tokenKey].symbol})</span>
        <input
          value={stake}
          onChange={(e) => setStake(e.target.value)}
          inputMode="decimal"
          className="w-full rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3"
        />
      </label>

      <label className="space-y-2">
        <span className="text-sm text-neutral-400">Players: {seats}</span>
        <input
          type="range"
          min={MIN_PLAYERS}
          max={MAX_PLAYERS}
          value={seats}
          onChange={(e) => setSeats(Number(e.target.value))}
          className="w-full accent-yellow-400"
        />
      </label>

      <button
        type="button"
        onClick={create}
        disabled={busy}
        className="rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50"
      >
        {busy ? "Creating…" : "Create arena"}
      </button>
    </main>
  );
}
