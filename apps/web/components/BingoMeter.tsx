import { cn } from "../lib/utils";

const LETTERS = ["B", "I", "N", "G", "O"];

/// BINGO progress: one letter lights up per completed line (1 line -> B, 2 -> I,
/// ... 5 -> O). All five lit means a winning board (5 lines) — time to claim.
export function BingoMeter({ lines }: { lines: number }) {
  const won = lines >= 5;
  return (
    <div className="flex items-center gap-1.5" aria-label={`${Math.min(lines, 5)} of 5 lines complete`}>
      {LETTERS.map((ch, i) => (
        <span
          key={ch}
          className={cn(
            "flex size-8 items-center justify-center rounded-lg font-anton text-base transition-all duration-300",
            i < lines
              ? "bg-neon text-navy shadow-glow"
              : "border border-white/10 bg-card/60 text-muted-foreground",
            won && "animate-pulse",
          )}
        >
          {ch}
        </span>
      ))}
      {won && <span className="ml-1 font-anton text-sm uppercase tracking-wide text-neon">Bingo!</span>}
    </div>
  );
}
