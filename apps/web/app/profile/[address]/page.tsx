"use client";

import { useParams } from "next/navigation";
import { isAddress } from "viem";
import { PageHeader } from "../../../components/PageHeader";
import { BackButton } from "../../../components/BackButton";
import { PublicProfile } from "../../../components/PublicProfile";

/// Public, read-only profile for any wallet, reachable by clicking a player's
/// avatar or name anywhere in the app (see profileHref). The editable own-profile
/// lives at /profile.
export default function PublicProfilePage() {
  const raw = useParams<{ address: string }>().address ?? "";
  const address = raw.toLowerCase();
  const valid = isAddress(address);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-5 px-5 py-10 md:px-6">
      <BackButton />
      <PageHeader eyebrow="Player" title="Profile" accent="stats" />
      {valid ? (
        <PublicProfile address={address} />
      ) : (
        <p className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">Invalid wallet address.</p>
      )}
    </main>
  );
}
