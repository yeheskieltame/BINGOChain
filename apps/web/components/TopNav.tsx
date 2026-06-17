"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "../lib/utils";
import { ConnectButton } from "./ConnectButton";

const TABS = [
  { href: "/", label: "Home" },
  { href: "/arenas", label: "Arenas" },
  { href: "/competition", label: "Cup" },
  { href: "/how-to-play", label: "How to play" },
  { href: "/profile", label: "Profile" },
];

/// Desktop-only sticky header in the cinematic style: a floating liquid-glass
/// pill nav (mirrors the landing) between the neon wordmark and Connect. Hidden
/// below md (BottomNav takes over) and on the landing route (it has its own nav).
export function TopNav() {
  const path = usePathname() ?? "/";
  if (path === "/") return null;
  return (
    <header className="sticky top-0 z-40 hidden md:block">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
          <span className="font-anton text-xl uppercase tracking-tight">
            <span className="text-gradient-gold">BINGO</span>
            <span className="text-foreground">Chain</span>
          </span>
        </Link>
        <nav className="liquid-glass rounded-full px-8 py-3">
          <ul className="flex items-center gap-7">
            {TABS.map(({ href, label }) => {
              const active = href === "/" ? path === "/" : path.startsWith(href);
              return (
                <li key={href}>
                  <Link
                    href={href}
                    className={cn(
                      "font-anton text-[13px] uppercase tracking-wide transition-colors",
                      active ? "text-neon" : "text-cream/80 hover:text-neon",
                    )}
                  >
                    {label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}
