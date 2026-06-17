"use client";

import { shortAddress } from "../lib/format";
import { cn } from "../lib/utils";
import { PlayerAvatar } from "./PlayerAvatar";

const AVATAR_PX = { sm: 20, md: 28, lg: 40 } as const;

/**
 * Canonical way to render a player anywhere in the app: avatar + label.
 * Pass `name` when a display name is known (e.g. from the profile backend in a
 * later slice); otherwise it falls back to the shortened address. Keeping this
 * one component means identity upgrades land everywhere at once.
 */
export function Player({
  address,
  name,
  imageUrl,
  subtitle,
  size = "md",
  className,
}: {
  address: string;
  name?: string;
  imageUrl?: string | null;
  subtitle?: string;
  size?: keyof typeof AVATAR_PX;
  className?: string;
}) {
  const label = name ?? shortAddress(address);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <PlayerAvatar address={address} imageUrl={imageUrl} size={AVATAR_PX[size]} />
      <span className="min-w-0">
        <span className={cn("block truncate text-foreground", name ? "font-medium" : "font-mono text-sm")}>
          {label}
        </span>
        {subtitle && <span className="block truncate text-xs text-muted-foreground">{subtitle}</span>}
      </span>
    </span>
  );
}
