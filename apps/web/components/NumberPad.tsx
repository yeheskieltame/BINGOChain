"use client";

import { motion } from "motion/react";
import { cn } from "../lib/utils";

/// 1..25 grid for calling numbers. Already-called numbers are disabled.
export function NumberPad({
  called,
  disabled,
  onCall,
  lastCalled,
}: {
  called: Set<number>;
  disabled?: boolean;
  onCall: (n: number) => void;
  lastCalled?: number;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => {
        const used = called.has(n);
        return (
          <motion.button
            key={n}
            type="button"
            disabled={used || disabled}
            onClick={() => onCall(n)}
            whileTap={{ scale: 0.92 }}
            className={cn(
              "relative aspect-square rounded-lg font-mono text-sm font-bold transition-colors",
              used
                ? "bg-card/40 text-muted-foreground/40"
                : "border border-white/[0.06] bg-card/70 text-foreground enabled:hover:border-gold-400/40 enabled:hover:text-gold-300 disabled:opacity-40",
            )}
          >
            {used && n === lastCalled && (
              <span className="pointer-events-none absolute inset-0 rounded-lg ring-1 ring-gold-300/60" />
            )}
            {n}
          </motion.button>
        );
      })}
    </div>
  );
}
