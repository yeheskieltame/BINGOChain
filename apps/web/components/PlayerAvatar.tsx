"use client";

import { useId, useMemo } from "react";
import { identicon } from "../lib/identicon";
import { cn } from "../lib/utils";

export function PlayerAvatar({
  address,
  imageUrl,
  size = 28,
  className,
}: {
  address: string;
  imageUrl?: string | null;
  size?: number;
  className?: string;
}) {
  const ic = useMemo(() => identicon(address), [address]);
  const uid = useId().replace(/:/g, "");
  const clip = `ic-${uid}`;

  // A set avatar takes priority; otherwise fall back to the deterministic identicon.
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={`Avatar for ${address}`}
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={cn("shrink-0 rounded-full object-cover ring-1 ring-white/10", className)}
      />
    );
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn("shrink-0 rounded-full ring-1 ring-white/10", className)}
      role="img"
      aria-label={`Avatar for ${address}`}
    >
      <defs>
        <clipPath id={clip}>
          <circle cx="50" cy="50" r="50" />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clip})`}>
        <rect width="100" height="100" fill={ic.bg} />
        {ic.shapes.map((s, i) => (
          <rect
            key={i}
            width="100"
            height="100"
            fill={s.color}
            transform={`translate(${s.x} ${s.y}) rotate(${s.rot} 50 50) scale(${s.scale})`}
          />
        ))}
      </g>
    </svg>
  );
}
