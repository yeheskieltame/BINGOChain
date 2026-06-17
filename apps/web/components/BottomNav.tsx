"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, LayoutGrid, Trophy, User } from "lucide-react";
import { cn } from "../lib/utils";

const TABS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/arenas", label: "Arenas", icon: LayoutGrid },
  { href: "/competition", label: "Cup", icon: Trophy },
  { href: "/profile", label: "Profile", icon: User },
];

/// Mobile bottom navigation, cinematic style: a floating liquid-glass pill.
/// Hidden on md+ (TopNav takes over) and on the landing route.
export function BottomNav() {
  const path = usePathname() ?? "/";
  if (path === "/") return null;
  return (
    <nav className="fixed inset-x-4 bottom-4 z-50 rounded-[1.5rem] border border-white/10 bg-navy/80 shadow-lg shadow-black/40 backdrop-blur-xl md:hidden">
      <div className="flex items-stretch justify-around px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[0.6rem] font-anton uppercase tracking-wide transition-colors",
                active ? "text-neon" : "text-cream/60 hover:text-cream",
              )}
            >
              <Icon className={cn("size-5", active && "drop-shadow-[0_0_6px_hsl(var(--primary)/0.6)]")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
