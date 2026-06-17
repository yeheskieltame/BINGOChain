"use client";

import { useEffect, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

/// Live ticking countdown to an ISO timestamp. Renders a stable placeholder
/// until mounted to avoid SSR hydration mismatch.
export function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (now === null) return <span className="font-mono text-sm text-muted-foreground">—</span>;

  const ms = Math.max(0, new Date(to).getTime() - now);
  if (ms <= 0) return <span className="font-mono text-sm text-muted-foreground">ended</span>;

  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  return (
    <span className="font-mono text-sm font-semibold text-gold-300">
      {d > 0 ? `${d}d ` : ""}
      {pad(h)}:{pad(m)}:{pad(sec)}
    </span>
  );
}
