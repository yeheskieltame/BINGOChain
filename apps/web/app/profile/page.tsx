"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { LancePanel } from "../../components/LancePanel";
import { ConnectButton } from "../../components/ConnectButton";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-yellow-400">Wallet</h1>
        <ConnectButton />
      </div>

      <Link href="/arenas" className="text-sm text-neutral-400 hover:text-neutral-200">← Back to arenas</Link>

      {isConnected && address ? (
        <>
          <p className="break-all rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-3 font-mono text-xs text-neutral-400">
            {address}
          </p>
          <LancePanel />
          <p className="text-xs text-neutral-600">
            $LANCE is the shared economy credit — buy it with CELO, use it to play arenas, redeem it back anytime.
          </p>
        </>
      ) : (
        <p className="text-sm text-neutral-500">Connect your wallet to buy or redeem $LANCE.</p>
      )}
    </main>
  );
}
