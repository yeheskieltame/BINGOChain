"use client";

import { motion } from "motion/react";
import { cn } from "../lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

/// Renders a 5×5 board. Called cells are gold; the most recently called pulses.
export function BoardGrid({
  board,
  called,
  lastCalled,
}: {
  board: number[];
  called?: Set<number>;
  lastCalled?: number;
}) {
  return (
    <motion.div
      className="grid grid-cols-5 gap-1.5"
      initial="hidden"
      animate="show"
      variants={{ show: { transition: { staggerChildren: 0.018 } } }}
    >
      {board.map((n, i) => {
        const marked = called?.has(n);
        const isLast = marked && n === lastCalled;
        return (
          <motion.div
            key={i}
            variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1 } }}
            transition={{ duration: 0.3, ease: EASE }}
            className={cn(
              "relative flex aspect-square items-center justify-center rounded-lg font-mono text-sm font-bold transition-colors",
              marked
                ? "bg-gold-sheen text-primary-foreground shadow-glow"
                : "border border-white/[0.06] bg-card/60 text-muted-foreground",
            )}
          >
            {isLast && (
              <motion.span
                className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-gold-300"
                initial={{ opacity: 0.8, scale: 0.9 }}
                animate={{ opacity: 0, scale: 1.45 }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            )}
            {n}
          </motion.div>
        );
      })}
    </motion.div>
  );
}
