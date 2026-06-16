"use client";

import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { formatUnits, maxUint256, parseUnits, type Hash } from "viem";
import { CHAIN_ID } from "../lib/bingo";
import { erc20Abi, lanceAbi, LANCE_ADDRESS, LANCE_ASSET, LANCE_DECIMALS } from "../lib/lance";

const WAD = 10n ** 18n;
type Mode = "buy" | "redeem";

/** Buy / redeem $LANCE — deposit CELO to mint at NAV, or burn back to CELO (−fee).
 *  $LANCE is the credit you can stake to play BingoChain arenas. */
export function LancePanel() {
  const { address, isConnected } = useAccount();
  const client = usePublicClient({ chainId: CHAIN_ID });
  const { writeContractAsync } = useWriteContract();

  const [mode, setMode] = useState<Mode>("buy");
  const [amount, setAmount] = useState("");
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const enabled = { enabled: Boolean(address) } as const;
  const { data: celoRaw, refetch: refetchCelo } = useReadContract({ address: LANCE_ASSET, abi: erc20Abi, functionName: "balanceOf", args: address ? [address] : undefined, chainId: CHAIN_ID, query: enabled });
  const { data: lanceRaw, refetch: refetchLance } = useReadContract({ address: LANCE_ADDRESS, abi: lanceAbi, functionName: "balanceOf", args: address ? [address] : undefined, chainId: CHAIN_ID, query: enabled });
  const { data: navRaw } = useReadContract({ address: LANCE_ADDRESS, abi: lanceAbi, functionName: "nav", chainId: CHAIN_ID });
  const { data: feeRaw } = useReadContract({ address: LANCE_ADDRESS, abi: lanceAbi, functionName: "redeemFeeBps", chainId: CHAIN_ID });
  const { data: allowanceRaw, refetch: refetchAllowance } = useReadContract({ address: LANCE_ASSET, abi: erc20Abi, functionName: "allowance", args: address ? [address, LANCE_ADDRESS] : undefined, chainId: CHAIN_ID, query: enabled });

  const celo = typeof celoRaw === "bigint" ? celoRaw : 0n;
  const lance = typeof lanceRaw === "bigint" ? lanceRaw : 0n;
  const nav = typeof navRaw === "bigint" && navRaw > 0n ? navRaw : WAD / 1000n;
  const feeBps = typeof feeRaw === "number" ? feeRaw : 100;

  const { isSuccess: done } = useWaitForTransactionReceipt({ hash: txHash ?? undefined });
  useEffect(() => {
    if (!done) return;
    setAmount("");
    void refetchCelo(); void refetchLance(); void refetchAllowance();
  }, [done, refetchCelo, refetchLance, refetchAllowance]);

  const balance = mode === "buy" ? celo : lance;
  const valid = /^\d+(\.\d+)?$/.test(amount.trim()) && Number(amount) > 0;
  const parsed = valid ? safeParse(amount, mode === "buy" ? 18 : LANCE_DECIMALS) : null;
  const over = parsed !== null && parsed > balance;
  const canSubmit = isConnected && valid && parsed !== null && !over && !busy;

  const preview =
    parsed === null ? 0n
      : mode === "buy" ? (parsed * WAD) / nav
        : (parsed * nav * BigInt(10_000 - feeBps)) / (WAD * 10_000n);

  async function submit() {
    setErr(null);
    if (!canSubmit || parsed === null || !address || !client) return;
    setBusy(true);
    try {
      if (mode === "buy") {
        const allowance = typeof allowanceRaw === "bigint" ? allowanceRaw : 0n;
        if (allowance < parsed) {
          const ah = await writeContractAsync({ address: LANCE_ASSET, abi: erc20Abi, functionName: "approve", args: [LANCE_ADDRESS, maxUint256], chainId: CHAIN_ID });
          await client.waitForTransactionReceipt({ hash: ah });
        }
        const h = await writeContractAsync({ address: LANCE_ADDRESS, abi: lanceAbi, functionName: "deposit", args: [parsed, address], chainId: CHAIN_ID });
        setTxHash(h);
      } else {
        const h = await writeContractAsync({ address: LANCE_ADDRESS, abi: lanceAbi, functionName: "redeem", args: [parsed, address, address], chainId: CHAIN_ID });
        setTxHash(h);
      }
    } catch (e) {
      setErr((e as { shortMessage?: string })?.shortMessage ?? (e as Error)?.message ?? "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  const fmt = (v: bigint, d = 18, max = 4) => Number(formatUnits(v, d)).toLocaleString("en-US", { maximumFractionDigits: max });
  const rate = fmt((WAD * WAD) / nav, 18, 0);

  return (
    <div className="space-y-4 rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-black text-yellow-400">$LANCE</h2>
        <span className="text-xs text-neutral-500">~{rate} LANCE / CELO</span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-center text-xs">
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
          <div className="text-neutral-500">Your $LANCE</div>
          <div className="mt-0.5 font-mono text-sm font-semibold">{fmt(lance)}</div>
        </div>
        <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2">
          <div className="text-neutral-500">Your CELO</div>
          <div className="mt-0.5 font-mono text-sm font-semibold">{fmt(celo)}</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["buy", "redeem"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setAmount(""); setErr(null); }}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold capitalize ${mode === m ? "border-yellow-400 bg-yellow-400/10 text-yellow-400" : "border-neutral-700 text-neutral-300"}`}
          >
            {m}
          </button>
        ))}
      </div>

      <label className="block space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-neutral-400">{mode === "buy" ? "Spend CELO" : "Redeem $LANCE"}</span>
          <button type="button" onClick={() => setAmount(formatUnits(balance, mode === "buy" ? 18 : LANCE_DECIMALS))} className="font-mono text-xs text-neutral-400 underline-offset-2 hover:underline">
            Max: {fmt(balance, mode === "buy" ? 18 : LANCE_DECIMALS, 4)}
          </button>
        </div>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="0.0"
          className={`w-full rounded-xl border bg-neutral-950 px-4 py-3 ${over ? "border-red-500" : "border-neutral-700"}`}
        />
        {over ? <span className="text-xs text-red-400">Amount exceeds your balance.</span> : null}
      </label>

      <div className="rounded-xl border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-neutral-400">
        {mode === "buy"
          ? <>You receive ≈ <span className="font-mono text-neutral-200">{fmt(preview)}</span> $LANCE</>
          : <>You receive ≈ <span className="font-mono text-neutral-200">{fmt(preview)}</span> CELO <span className="opacity-70">(after {(feeBps / 100).toFixed(2)}% fee)</span></>}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="w-full rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-neutral-950 disabled:opacity-50"
      >
        {busy ? "Working…" : isConnected ? (mode === "buy" ? "Buy $LANCE" : "Redeem to CELO") : "Connect a wallet"}
      </button>

      {err ? <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{err}</p> : null}
    </div>
  );
}

function safeParse(value: string, decimals: number): bigint | null {
  try { return parseUnits(value as `${number}`, decimals); } catch { return null; }
}
