"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

/// Shared cosmic backdrop for every in-app page: the landing's hero scene as a
/// fixed, dimmed still, veiled toward the bottom so content stays legible, with
/// a neon aurora echoing the planet and a faint film grain. Hidden on "/" — the
/// landing renders its own full-bleed looping video instead.
export function SpaceBackdrop() {
  const path = usePathname() ?? "/";
  if (path === "/") return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-navy">
      <Image
        src="/space-bg.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="scale-110 object-cover object-[50%_28%] opacity-70 [filter:blur(2px)]"
      />
      {/* Legibility veil — lighter over the dark sky up top, near-solid at the
          bottom where the card grids sit. */}
      <div className="absolute inset-0 bg-gradient-to-b from-navy/50 via-navy/70 to-navy/95" />
      {/* Neon aurora, top-right, echoing the ruby planet. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(42rem 30rem at 82% -10%, hsl(var(--primary) / 0.13), transparent 62%)",
        }}
      />
      {/* Faint film grain bound to the backdrop (kept off the content so text
          stays crisp). */}
      <div className="noise-bg absolute inset-0 opacity-[0.5] mix-blend-soft-light" />
    </div>
  );
}
