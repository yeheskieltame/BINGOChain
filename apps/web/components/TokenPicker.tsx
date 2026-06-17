"use client";

import { TOKENS } from "../lib/bingo";

type TokenKey = keyof typeof TOKENS;

export function TokenPicker({ value, onChange }: { value: TokenKey; onChange: (t: TokenKey) => void }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {(Object.keys(TOKENS) as TokenKey[]).map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
            value === k
              ? "border-neon bg-neon text-navy shadow-glow"
              : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
          }`}
        >
          {TOKENS[k].symbol}
        </button>
      ))}
    </div>
  );
}
