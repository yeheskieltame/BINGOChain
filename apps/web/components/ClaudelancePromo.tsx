"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ArrowUpRight, Coins, LayoutGrid, X } from "lucide-react";

/// Dismissible "Claudelance ecosystem" promo shown across BINGOChain. It cross-
/// promotes the two products BINGOChain is built on: Claudelance (the onchain
/// marketplace for AI-agent labor) and the new Claudelance Coworking board.
/// Solid navy card (no glass translucency, fully opaque) carrying the Claudelance
/// logo, so it reads as a crisp, native part of the app. The dismissal key is
/// versioned: bumping it re-shows the redesign to everyone who dismissed before.
const KEY = "cl-ecosystem-promo-dismissed-v3";

type Promo = {
  href: string;
  icon: typeof Coins;
  badge?: string;
  title: string;
  blurb: string;
};

const PROMOS: Promo[] = [
  {
    href: "https://claudelance.xyz",
    icon: Coins,
    title: "Claudelance",
    blurb: "The onchain marketplace where AI agents take bounties for real rewards.",
  },
  {
    href: "https://claudelance.xyz/coworking",
    icon: LayoutGrid,
    badge: "New",
    title: "Coworking",
    blurb: "Agent-native task board for your agents and team. REST plus MCP.",
  },
];

export function ClaudelancePromo() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;
    const t = setTimeout(() => setShow(true), 1600);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore storage errors */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="animate-fade-rise fixed bottom-24 right-4 z-40 w-[20rem] max-w-[calc(100vw-2rem)] md:bottom-4">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-navy p-4 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_0_rgba(255,255,255,0.08)]">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-neon/15 blur-2xl"
        />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-cream/50 transition-colors hover:bg-white/10 hover:text-cream"
        >
          <X className="size-3.5" />
        </button>

        <div className="flex items-center gap-2.5 pr-6">
          <Image
            src="/claudelance-logo.png"
            alt="Claudelance"
            width={36}
            height={36}
            className="size-9 shrink-0 rounded-lg"
          />
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neon/80">Claudelance Ecosystem</p>
            <p className="font-anton text-base uppercase leading-tight text-cream">Built on Claudelance</p>
          </div>
        </div>

        <div className="mt-3 space-y-1.5">
          {PROMOS.map(({ href, icon: Icon, badge, title, blurb }) => (
            <a
              key={href}
              href={href}
              target="_blank"
              rel="noreferrer"
              className="group/row flex gap-2.5 rounded-xl border border-white/5 bg-white/[0.03] p-2.5 transition-colors hover:border-neon/30 hover:bg-white/[0.06]"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-neon/15 text-neon">
                <Icon className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="font-anton text-xs uppercase tracking-wide text-cream">{title}</span>
                  {badge ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neon/15 px-1.5 py-px font-mono text-[8px] uppercase tracking-wider text-neon">
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-neon/70" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-neon" />
                      </span>
                      {badge}
                    </span>
                  ) : null}
                  <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-cream/40 transition-all group-hover/row:-translate-y-0.5 group-hover/row:translate-x-0.5 group-hover/row:text-neon" />
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-cream/60">{blurb}</span>
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
