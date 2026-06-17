"use client";

import { motion } from "motion/react";
import { cn } from "../lib/utils";
import { LINES, completedLineIndices } from "../lib/board";

// Cell center in a 0..100 viewBox (5 columns), used to strike completed lines.
const center = (cell: number) => ({ x: (cell % 5) * 20 + 10, y: Math.floor(cell / 5) * 20 + 10 });

/// Renders a 5×5 board. Called cells are gold; the most recently called pulses.
/// Each completed row/column/diagonal gets a neon strike so the player can see
/// at a glance how many lines they have.
export function BoardGrid({
  board,
  called,
  lastCalled,
}: {
  board: number[];
  called?: Set<number>;
  lastCalled?: number;
}) {
  const struck = called ? completedLineIndices(board, called) : [];

  return (
    <div className="relative">
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

      {struck.length > 0 && (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
        >
          {struck.map((li) => {
            const a = center(LINES[li][0]);
            const b = center(LINES[li][4]);
            return (
              <g key={li}>
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="hsl(var(--primary))" strokeWidth={7} strokeLinecap="round" opacity={0.25} />
                <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="hsl(var(--primary))" strokeWidth={3.5} strokeLinecap="round" opacity={0.95} />
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
