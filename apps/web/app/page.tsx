"use client";

import Link from "next/link";
import { useAccount, useConnect, useReadContract } from "wagmi";
import { motion } from "motion/react";
import { ShieldCheck, Link2, Trophy } from "lucide-react";
import { bingoAbi, BINGO_ADDRESS, CHAIN_ID } from "../lib/bingo";
import { useMiniPay } from "../hooks/useMiniPay";
import { shortAddress } from "../lib/format";
import { Button } from "../components/ui/button";
import { LiveStats } from "../components/LiveStats";

const EASE = [0.22, 1, 0.36, 1] as const;
const rise = (delay: number) => ({
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay, ease: EASE },
});

const FEATURES = [
  { icon: ShieldCheck, title: "Sealed", desc: "Commit–reveal boards" },
  { icon: Link2, title: "Onchain", desc: "Every call recorded" },
  { icon: Trophy, title: "Verifiable", desc: "Replay decides the winner" },
];

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
    <main className="mx-auto flex min-h-screen max-w-md flex-col px-5 py-14 md:max-w-6xl md:px-6 md:py-10">
      <div className="flex flex-1 flex-col justify-start md:justify-center">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center lg:gap-16">
          {/* Hero copy + calls to action */}
          <div className="flex flex-col gap-6">
            <motion.header {...rise(0)} className="space-y-3 md:space-y-4">
              <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/20 bg-gold-400/5 px-3 py-1 text-xs font-medium text-gold-300">
                <span className="size-1.5 rounded-full bg-gold-400" /> Onchain · Celo Mainnet
              </span>
              <h1 className="font-display text-5xl font-extrabold tracking-tight lg:text-7xl">
                <span className="text-gradient-gold">BINGO</span>
                <span className="text-foreground">Chain</span>
              </h1>
              <p className="text-sm leading-relaxed text-muted-foreground lg:text-base">
                Strategic onchain bingo on Celo. Seal a 5×5 board, call numbers in turn, and the winner is
                proven by replaying the game — cheating is mathematically impossible.
              </p>
            </motion.header>

            <motion.div {...rise(0.08)} className="flex flex-col gap-3 sm:max-w-sm">
              {isConnected ? (
                <div className="glass flex items-center justify-between rounded-xl px-4 py-3 text-sm">
                  <span className="text-muted-foreground">Connected</span>
                  <span className="inline-flex items-center gap-2 font-mono text-gold-300">
                    <span className="size-2 rounded-full bg-state-open" />
                    {address && shortAddress(address)}
                  </span>
                </div>
              ) : (
                <Button size="lg" onClick={() => connect({ connector: connectors[0] })}>
                  Connect wallet
                </Button>
              )}
              <Button asChild variant={isConnected ? "default" : "secondary"} size="lg">
                <Link href="/arenas">Enter the lobby →</Link>
              </Button>
              <Link
                href="/how-to-play"
                className="text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-gold-300 hover:underline"
              >
                New here? How to play →
              </Link>
              {isMiniPay && <p className="text-center text-xs text-state-open">MiniPay detected — auto-connected.</p>}
            </motion.div>
          </div>

          {/* Live numbers + how it stays fair */}
          <div className="flex flex-col gap-4">
            <motion.div {...rise(0.16)}>
              <LiveStats />
            </motion.div>

            <motion.section {...rise(0.22)} className="grid grid-cols-3 gap-3">
              {FEATURES.map(({ icon: Icon, title, desc }) => (
                <div key={title} className="glass rounded-xl p-3 text-center md:p-4">
                  <Icon className="mx-auto mb-2 size-5 text-gold-400" />
                  <p className="font-display text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-1 text-[0.7rem] leading-snug text-muted-foreground">{desc}</p>
                </div>
              ))}
            </motion.section>
          </div>
        </div>
      </div>

      <footer className="mt-12 text-center text-xs text-muted-foreground">
        Contract v<span className="font-mono text-foreground">{version ?? "…"}</span> · Celo Mainnet
      </footer>
    </main>
  );
}
