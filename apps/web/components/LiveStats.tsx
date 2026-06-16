"use client";

import { useEffect, useState } from "react";
import { getStats, type Stats } from "../lib/api";

/// Live network stats from the backend indexer — gives the landing a pulse.
export function LiveStats() {
  const [s, setS] = useState<Stats | null>(null);

  useEffect(() => {
    getStats().then(setS).catch(() => {});
  }, []);

  const items: [string, string | number | undefined][] = [
    ["Players", s?.players],
    ["Games", s?.games],
    ["$LANCE vol", s?.volume],
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map(([k, v]) => (
        <div key={k} className="glass rounded-xl p-3 text-center">
          <p className="font-mono text-lg font-bold text-gold-300">{v ?? "—"}</p>
          <p className="mt-0.5 text-[0.65rem] uppercase tracking-wider text-muted-foreground">{k}</p>
        </div>
      ))}
    </div>
  );
}
