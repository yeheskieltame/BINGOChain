"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowUpRight, LayoutGrid, Sprout, X, type LucideIcon } from "lucide-react";

/// Dismissible "ecosystem" promo shown across BINGOChain. One solid-navy card
/// that rotates through the sibling products BINGOChain lives alongside:
/// Claudelance (the onchain marketplace it is built on), Claudelance Coworking,
/// and the OwnaFarm partner project. Auto-rotates, pauses on hover/focus, and
/// lets the user drive it with the dots. The dismissal key is versioned: bump it
/// to re-show the redesign to everyone who dismissed an older one.
const KEY = "cl-ecosystem-promo-dismissed-v4";
const ROTATE_MS = 5000;

type Promo = {
  key: string;
  href: string;
  logo?: string;
  icon?: LucideIcon;
  badge?: string;
  eyebrow: string;
  title: string;
  blurb: string;
  cta: string;
};

const PROMOS: Promo[] = [
  {
    key: "claudelance",
    href: "https://claudelance.xyz",
    logo: "/claudelance-logo.png",
    eyebrow: "Built on Claudelance",
    title: "Claudelance",
    blurb: "The onchain marketplace where AI agents take bounties for real rewards.",
    cta: "Open Claudelance",
  },
  {
    key: "coworking",
    href: "https://claudelance.xyz/coworking",
    icon: LayoutGrid,
    badge: "New",
    eyebrow: "Claudelance ecosystem",
    title: "Coworking",
    blurb: "Agent-native task board for your agents and team. REST plus MCP.",
    cta: "Take a look",
  },
  {
    key: "ownafarm",
    href: "https://ownafarm.xyz",
    icon: Sprout,
    eyebrow: "Partner project",
    title: "OwnaFarm",
    blurb: "Plant seeds, fund real farms, harvest yields. Real-world-asset GameFi on Mantle.",
    cta: "Explore OwnaFarm",
  },
];

export function ClaudelancePromo() {
  const reduce = useReducedMotion();
  const [show, setShow] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;
    const t = setTimeout(() => setShow(true), 1600);
    return () => clearTimeout(t);
  }, []);

  // Auto-rotate, paused on hover/focus and for reduced-motion users (who drive
  // it with the dots instead). ponytail: setInterval, no carousel lib.
  useEffect(() => {
    if (!show || paused || reduce) return;
    const t = setInterval(() => setIndex((n) => (n + 1) % PROMOS.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [show, paused, reduce]);

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore storage errors */
    }
    setShow(false);
  }

  if (!show) return null;
  const p = PROMOS[index];
  const Icon = p.icon;

  return (
    <div
      className="fixed bottom-24 right-4 z-40 w-[20rem] max-w-[calc(100vw-2rem)] md:bottom-4"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <motion.div
        initial={{ opacity: 0, y: 12, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-navy p-4 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_0_rgba(255,255,255,0.08)]"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-neon/15 blur-2xl"
        />

        <button
          type="button"
          onClick={dismiss}
          aria-label="Dismiss"
          className="absolute right-2.5 top-2.5 z-10 flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-cream/70 transition-colors hover:bg-white/15 hover:text-cream"
        >
          <X className="size-[18px]" />
        </button>

        <AnimatePresence mode="wait">
          <motion.a
            key={p.key}
            href={p.href}
            target="_blank"
            rel="noreferrer"
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 14 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, x: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, x: -14 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
            className="group/row block pr-9"
          >
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-neon/80">{p.eyebrow}</p>

            <div className="mt-2 flex items-start gap-2.5">
              {p.logo ? (
                <Image
                  src={p.logo}
                  alt={p.title}
                  width={40}
                  height={40}
                  className="size-10 shrink-0 rounded-lg"
                />
              ) : Icon ? (
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-neon/15 text-neon">
                  <Icon className="size-5" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5">
                  <span className="font-anton text-base uppercase leading-tight text-cream">{p.title}</span>
                  {p.badge ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-neon/15 px-1.5 py-px font-mono text-[8px] uppercase tracking-wider text-neon">
                      <span className="relative flex size-1.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-neon/70" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-neon" />
                      </span>
                      {p.badge}
                    </span>
                  ) : null}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-cream/60">{p.blurb}</span>
              </div>
            </div>

            <span className="mt-3 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-wide text-neon transition-colors group-hover/row:text-cream">
              {p.cta}
              <ArrowUpRight className="size-3.5 transition-transform group-hover/row:-translate-y-0.5 group-hover/row:translate-x-0.5" />
            </span>
          </motion.a>
        </AnimatePresence>

        <div className="mt-3 flex items-center gap-1.5">
          {PROMOS.map((promo, idx) => (
            <button
              key={promo.key}
              type="button"
              onClick={() => setIndex(idx)}
              aria-label={`Show ${promo.title}`}
              aria-current={idx === index}
              className={`h-1.5 rounded-full transition-all ${
                idx === index ? "w-5 bg-neon" : "w-1.5 bg-white/20 hover:bg-white/40"
              }`}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}
