"use client";

import Link from "next/link";
import { PlayerAvatar } from "./PlayerAvatar";
import { CopyAddress } from "./CopyAddress";
import { shortAddress } from "../lib/format";
import type { Profile } from "../lib/api";

/// Public profile header: large avatar, display name (or short address), the full
/// address (copyable), and bio. Shows an edit shortcut when viewing your own.
export function ProfileHeader({
  address,
  profile,
  isYou,
}: {
  address: string;
  profile: Profile | null;
  isYou?: boolean;
}) {
  const name = profile?.name?.trim();
  return (
    <section className="glass flex flex-col items-center gap-4 rounded-2xl p-6 text-center sm:flex-row sm:items-start sm:text-left">
      <PlayerAvatar address={address} imageUrl={profile?.avatar_url} size={88} className="ring-2 ring-gold-400/30" />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-col items-center gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="font-display text-2xl font-bold text-foreground">{name || shortAddress(address)}</h1>
          {isYou && (
            <Link
              href="/profile"
              className="shrink-0 rounded-full border border-gold-400/30 px-3 py-1 text-xs text-gold-300 transition-colors hover:bg-gold-400/10"
            >
              Edit your profile
            </Link>
          )}
        </div>
        <CopyAddress address={address} />
        {profile?.bio ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>
        ) : (
          <p className="text-sm italic text-muted-foreground/60">No bio yet.</p>
        )}
      </div>
    </section>
  );
}
