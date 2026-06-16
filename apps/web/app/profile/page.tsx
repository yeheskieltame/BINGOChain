"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { LancePanel } from "../../components/LancePanel";
import { ConnectButton } from "../../components/ConnectButton";
import { ProfileEditor } from "../../components/ProfileEditor";
import { PlayerStatsCard } from "../../components/PlayerStatsCard";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col gap-5 px-5 py-10">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-foreground">Profile</h1>
        <ConnectButton />
      </div>

      <Link href="/arenas" className="text-sm text-muted-foreground hover:text-foreground">
        ← Back to arenas
      </Link>

      {isConnected && address ? (
        <>
          <ProfileEditor />
          <PlayerStatsCard />
          <div className="space-y-2">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
              $LANCE wallet
            </h2>
            <LancePanel />
          </div>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Connect your wallet to set up your profile and manage $LANCE.</p>
      )}
    </main>
  );
}
