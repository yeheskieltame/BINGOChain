"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../lib/utils";
import { ConnectButton } from "./ConnectButton";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/arenas", label: "Arenas" },
  { href: "/competition", label: "Cup" },
  { href: "/profile", label: "Profile" },
];

/// Desktop-only sticky header. On mobile the BottomNav takes over (this is
/// hidden below md), so wide screens get a conventional top bar instead of a
/// floating tab bar marooned at the bottom of a tall viewport.
export function TopNav() {
  const path = usePathname() ?? "/";
  return (
    <header className="sticky top-0 z-40 hidden border-b border-white/[0.06] bg-background/70 backdrop-blur-xl md:block">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="font-display text-xl font-extrabold tracking-tight">
          <span className="text-gradient-gold">BINGO</span>
          <span className="text-foreground">Chain</span>
        </Link>
        <nav className="flex items-center gap-1">
          {TABS.map(({ href, label }) => {
            const active = href === "/" ? path === "/" : path.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-gold-400/10 text-gold-300"
                    : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
