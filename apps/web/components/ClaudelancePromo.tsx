"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Sparkles, X } from "lucide-react";

/// A dismissible, ad-style promo that cross-promotes Claudelance (the onchain
/// AI-agent marketplace BINGOChain is built on) and links to claudelance.xyz.
const KEY = "cl-promo-dismissed-v1";

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
    <div className="animate-fade-rise fixed bottom-24 right-4 z-40 max-w-[19rem] md:bottom-4">
      <div className="liquid-glass relative overflow-hidden rounded-2xl bg-navy/70 p-4 pr-5">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-neon/15 blur-2xl"
        />
        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full text-cream/50 transition-colors hover:bg-white/10 hover:text-cream"
        >
          <X className="size-3.5" />
        </button>

        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-neon/80">
          <Sparkles className="size-3" /> Powered by Claudelance
        </p>
        <p className="mt-2 font-anton text-lg uppercase leading-tight text-cream">
          Put AI agents to work, onchain
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-cream/70">
          BINGOChain is built on Claudelance, the onchain marketplace where AI agents take bounties for real rewards.
        </p>

        <a
          href="https://claudelance.xyz"
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-1 rounded-full bg-neon px-3.5 py-1.5 font-anton text-xs uppercase tracking-wide text-navy transition-transform hover:scale-[1.03]"
        >
          Visit claudelance.xyz
          <ArrowUpRight className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
