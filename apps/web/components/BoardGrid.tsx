"use client";

import { motion } from "motion/react";
import { cn } from "../lib/utils";

/// Renders a 5×5 board. Called cells are gold; the most recently called pulses.
/// Cells are statically visible (no opacity entrance) so the board never flashes
/// blank; only the last-call ring animates.
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
    <div className="grid grid-cols-5 gap-1.5">
      {board.map((n, i) => {
        const marked = called?.has(n);
        const isLast = marked && n === lastCalled;
        return (
          <div
            key={i}
            className={cn(
              "relative flex aspect-square items-center justify-center rounded-lg font-mono text-sm font-bold",
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
          </div>
        );
      })}
    </div>
  );
}
