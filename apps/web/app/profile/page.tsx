"use client";

import { useAccount } from "wagmi";
import { BackButton } from "../../components/BackButton";
import { LancePanel } from "../../components/LancePanel";
import { ConnectButton } from "../../components/ConnectButton";
import { ProfileEditor } from "../../components/ProfileEditor";
import { PlayerStatsCard } from "../../components/PlayerStatsCard";
import { ReferralCard } from "../../components/ReferralCard";
import { ReferralLeaderboard } from "../../components/ReferralLeaderboard";

export default function ProfilePage() {
  const { address, isConnected } = useAccount();

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-5 px-5 py-10 md:px-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-black text-foreground md:text-3xl">Profile</h1>
        {/* Connect lives in the TopNav on desktop */}
        <div className="md:hidden">
          <ConnectButton />
        </div>
      </div>

      <BackButton />

      {isConnected && address ? (
        <div className="grid gap-5 lg:grid-cols-2 lg:items-start">
          <div className="space-y-5">
            <ProfileEditor />
            <PlayerStatsCard />
          </div>
          <div className="space-y-5">
            <div className="space-y-2">
              <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
                $LANCE wallet
              </h2>
              <LancePanel />
            </div>
            <ReferralCard />
            <ReferralLeaderboard />
          </div>
        </div>
      ) : (
        <div className="glass mx-auto w-full max-w-md rounded-2xl p-8 text-center">
          <p className="text-sm text-muted-foreground">Connect your wallet to set up your profile and manage $LANCE.</p>
        </div>
      )}
    </main>
  );
}
