"use client";

/// 1..25 grid for calling numbers. Already-called numbers are disabled.
export function NumberPad({
  called,
  disabled,
  onCall,
}: {
  called: Set<number>;
  disabled?: boolean;
  onCall: (n: number) => void;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {Array.from({ length: 25 }, (_, i) => i + 1).map((n) => {
        const used = called.has(n);
        return (
          <button
            key={n}
            type="button"
            disabled={used || disabled}
            onClick={() => onCall(n)}
            className={`aspect-square rounded-lg text-sm font-bold transition ${
              used
                ? "bg-neutral-800 text-neutral-600"
                : "bg-neutral-700 text-neutral-100 enabled:hover:bg-gold-400 enabled:hover:text-neutral-950 disabled:opacity-40"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
