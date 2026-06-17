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

/// Persistent mobile-first bottom navigation, shown on every page.
export function BottomNav() {
  const path = usePathname() ?? "/";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/[0.06] bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[env(safe-area-inset-bottom)] pt-2">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? path === "/" : path.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 rounded-lg py-1.5 text-[0.65rem] font-medium transition-colors",
                active ? "text-gold-300" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5", active && "drop-shadow-[0_0_6px_hsl(var(--gold-400)/0.5)]")} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
