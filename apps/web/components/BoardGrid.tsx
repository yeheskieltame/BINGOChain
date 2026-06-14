"use client";

/// Renders a 5×5 board. Cells whose number has been called are highlighted.
export function BoardGrid({ board, called }: { board: number[]; called?: Set<number> }) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {board.map((n, i) => {
        const marked = called?.has(n);
        return (
          <div
            key={i}
            className={`flex aspect-square items-center justify-center rounded-lg text-sm font-bold ${
              marked ? "bg-yellow-400 text-neutral-950" : "bg-neutral-800 text-neutral-300"
            }`}
          >
            {n}
          </div>
        );
      })}
    </div>
  );
}
