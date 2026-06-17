"use client";

import { useState } from "react";
import { cn } from "../lib/utils";

/// Editable 5×5 board for joining an arena. The board is always a permutation of
/// 1..25 (so the commit is always valid), so editing is done by SWAPPING: tap one
/// cell, then tap another to swap their numbers. Strategy: numbers are called in
/// turn, so arranging where each number sits decides which lines complete first.
export function BoardBuilder({
  board,
  onChange,
  disabled,
}: {
  board: number[];
  onChange: (next: number[]) => void;
  disabled?: boolean;
}) {
  const [sel, setSel] = useState<number | null>(null);

  function tap(i: number) {
    if (disabled) return;
    if (sel === null) return setSel(i);
    if (sel === i) return setSel(null);
    const next = board.slice();
    [next[sel], next[i]] = [next[i], next[sel]];
    onChange(next);
    setSel(null);
  }

  return (
    <div className="grid grid-cols-5 gap-1.5">
      {board.map((n, i) => (
        <button
          key={i}
          type="button"
          onClick={() => tap(i)}
          disabled={disabled}
          aria-label={`Cell ${i + 1}, number ${n}${sel === i ? " (selected)" : ""}`}
          className={cn(
            "flex aspect-square items-center justify-center rounded-lg font-mono text-sm font-bold transition-all",
            sel === i
              ? "scale-105 border border-neon bg-neon/20 text-neon shadow-glow"
              : "border border-white/[0.06] bg-card/60 text-cream hover:border-neon/40",
            disabled && "opacity-60",
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}
