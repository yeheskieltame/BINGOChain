"use client";

import Link from "next/link";
import { profileHref, shortAddress } from "../lib/format";
import { cn } from "../lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";

const AVATAR_PX = { sm: 20, md: 28, lg: 40 } as const;

/**
 * Canonical way to render a player anywhere in the app: avatar + label.
 * Pass `name` when a display name is known (from the profile backend); otherwise
 * it falls back to the shortened address. Keeping this one component means
 * identity upgrades land everywhere at once.
 *
 * Links to the player's public profile by default — click an avatar/name
 * anywhere to view them. Pass `link={false}` to render a plain (non-link) chip.
 */
export function Player({
  address,
  name,
  imageUrl,
  size = "md",
  link = true,
  className,
}: {
  address: string;
  name?: string;
  imageUrl?: string | null;
  size?: keyof typeof AVATAR_PX;
  link?: boolean;
  className?: string;
}) {
  const label = name ?? shortAddress(address);
  const inner = (
    <>
      <PlayerAvatar address={address} imageUrl={imageUrl} size={AVATAR_PX[size]} />
      <span className="min-w-0">
        <span className={cn("block truncate text-foreground", name ? "font-medium" : "font-mono text-sm")}>{label}</span>
      </span>
    </>
  );

  if (link) {
    return (
      <Link
        href={profileHref(address)}
        className={cn("inline-flex min-w-0 items-center gap-2 rounded-full transition-opacity hover:opacity-80", className)}
        title={`View ${label}'s profile`}
      >
        {inner}
      </Link>
    );
  }

  return <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>{inner}</span>;
}
