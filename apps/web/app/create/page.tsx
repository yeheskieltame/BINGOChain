"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { decodeEventLog } from "viem";
import { usePublicClient, useWriteContract } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID, MIN_PLAYERS, MAX_PLAYERS, MIN_STAKE, TOKENS } from "../../lib/bingo";
import { parseAmount } from "../../lib/format";
import { TokenPicker } from "../../components/TokenPicker";
import { ConnectButton } from "../../components/ConnectButton";
import { BackButton } from "../../components/BackButton";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";

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

  const label = "block font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 px-5 py-10">
      <BackButton />
      <PageHeader eyebrow="Open a table" title="New arena" accent="go onchain" actions={<ConnectButton />} />

      <div className="glass flex flex-col gap-6 rounded-2xl p-5">
        <label className="space-y-2">
          <span className={label}>Settlement token</span>
          <TokenPicker value={tokenKey} onChange={pickToken} />
        </label>

        <label className="space-y-2">
          <span className={label}>Entry stake ({TOKENS[tokenKey].symbol})</span>
          <Input value={stake} onChange={(e) => setStake(e.target.value)} inputMode="decimal" />
        </label>

        <label className="space-y-3">
          <span className={`${label} flex items-baseline justify-between`}>
            Players
            <span className="font-mono text-base text-neon">{seats}</span>
          </span>
          <input
            type="range"
            min={MIN_PLAYERS}
            max={MAX_PLAYERS}
            value={seats}
            onChange={(e) => setSeats(Number(e.target.value))}
            className="w-full accent-neon"
          />
          <span className="flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>{MIN_PLAYERS}</span>
            <span>{MAX_PLAYERS}</span>
          </span>
        </label>

        <Button onClick={create} disabled={busy} size="lg" className="w-full">
          {busy ? "Creating…" : "Create arena"}
        </Button>
      </div>
    </main>
  );
}
