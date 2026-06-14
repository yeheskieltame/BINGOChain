"use client";

import Link from "next/link";
import { useAccount, useConnect, useReadContract } from "wagmi";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID } from "../lib/bingo";
import { useMiniPay } from "../hooks/useMiniPay";

export default function Home() {
  const { isMiniPay } = useMiniPay();
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();

  const { data: version } = useReadContract({
    abi: bingoAbi,
    address: BINGO_ADDRESS,
    functionName: "version",
    chainId: CHAIN_ID,
  });

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-8 px-5 py-12">
      <header className="space-y-2">
        <h1 className="text-4xl font-black tracking-tight text-yellow-400">BINGOChain</h1>
        <p className="text-sm text-neutral-400">
          Strategic onchain bingo on Celo. Seal a 5×5 board, call numbers in turn, and the
          winner is verified by replaying the game — cheating is mathematically impossible.
        </p>
      </header>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-900 p-5">
        {isConnected ? (
          <p className="text-sm">
            Connected: <span className="font-mono text-yellow-400">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
          </p>
        ) : (
          <button
            type="button"
            onClick={() => connect({ connector: connectors[0] })}
            className="w-full rounded-xl bg-yellow-400 px-4 py-3 font-semibold text-neutral-950 transition hover:bg-yellow-300"
          >
            Connect wallet
          </button>
        )}
        {isMiniPay && <p className="mt-2 text-xs text-emerald-400">MiniPay detected — auto-connected.</p>}
      </section>

      <Link
        href="/arenas"
        className="rounded-xl bg-yellow-400 px-4 py-3 text-center font-semibold text-neutral-950 transition hover:bg-yellow-300"
      >
        Play now →
      </Link>

      <section className="grid grid-cols-3 gap-3 text-center text-xs">
        {[
          ["Sealed", "commit–reveal boards"],
          ["Onchain", "every call recorded"],
          ["Verifiable", "replay decides the winner"],
        ].map(([t, d]) => (
          <div key={t} className="rounded-xl border border-neutral-800 bg-neutral-900 p-3">
            <p className="font-bold text-yellow-400">{t}</p>
            <p className="mt-1 text-neutral-500">{d}</p>
          </div>
        ))}
      </section>

      <footer className="mt-auto text-center text-xs text-neutral-600">
        Contract v{version ?? "…"} · Celo Mainnet
      </footer>
    </main>
  );
}
