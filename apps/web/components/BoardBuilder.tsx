"use client";

import { useState } from "react";
import { cn } from "../lib/utils";

const ALL = Array.from({ length: 25 }, (_, i) => i + 1);

/// Build a 5×5 board from an empty grid + a tray of the numbers 1..25.
/// Desktop: drag a number from the tray onto a cell. Everywhere (incl. mobile):
/// tap a tray number to arm it, then tap a cell to drop it; tap a filled cell to
/// send its number back to the tray. The board is complete when all 25 are placed.
export function BoardBuilder({
  value,
  onChange,
  disabled,
}: {
  value: (number | null)[];
  onChange: (next: (number | null)[]) => void;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState<number | null>(null);
  const placed = new Set(value.filter((n): n is number => n !== null));
  const tray = ALL.filter((n) => !placed.has(n));

  function placeAt(cell: number, num: number) {
    const next = value.slice();
    const prev = next.indexOf(num); // guard: keep it a permutation if num was elsewhere
    if (prev >= 0) next[prev] = null;
    next[cell] = num;
    onChange(next);
  }

  function tapCell(cell: number) {
    if (disabled) return;
    if (armed !== null) {
      placeAt(cell, armed);
      setArmed(null);
    } else if (value[cell] !== null) {
      const next = value.slice();
      next[cell] = null; // return that number to the tray
      onChange(next);
    }
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
      <div className="grid grid-cols-5 gap-1.5 lg:flex-1">
        {value.map((n, i) => (
          <button
            key={i}
            type="button"
            disabled={disabled}
            onClick={() => tapCell(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const num = Number(e.dataTransfer.getData("text/plain"));
              if (num) {
                placeAt(i, num);
                setArmed(null);
              }
            }}
            aria-label={n !== null ? `Cell ${i + 1}: ${n} (tap to remove)` : `Cell ${i + 1}: empty`}
            className={cn(
              "flex aspect-square items-center justify-center rounded-lg border font-mono text-sm font-bold transition-all",
              n !== null
                ? "border-neon/40 bg-neon/15 text-neon"
                : "border-dashed border-white/15 bg-card/40 text-muted-foreground",
              armed !== null && n === null && "border-neon/60 bg-neon/[0.07]",
            )}
          >
            {n ?? ""}
          </button>
        ))}
      </div>

      <div className="lg:w-44">
        <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {tray.length ? `Numbers · ${tray.length} left` : "Board complete"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {tray.map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              draggable={!disabled}
              onClick={() => setArmed(armed === n ? null : n)}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", String(n));
                setArmed(n);
              }}
              aria-label={`Number ${n}${armed === n ? " (armed)" : ""}`}
              className={cn(
                "flex size-9 items-center justify-center rounded-lg border font-mono text-sm font-bold transition-all",
                armed === n
                  ? "scale-110 border-neon bg-neon text-navy shadow-glow"
                  : "cursor-grab border-white/10 bg-card/60 text-cream hover:border-neon/40 active:cursor-grabbing",
              )}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
