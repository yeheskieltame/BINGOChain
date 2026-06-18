"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { cn } from "../lib/utils";

/// A pill showing a full wallet address with one-tap copy.
export function CopyAddress({ address, className }: { address: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      title="Copy address"
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full bg-card/60 px-2.5 py-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      <span className="truncate">{address}</span>
      {copied ? <Check className="size-3 shrink-0 text-state-open" /> : <Copy className="size-3 shrink-0" />}
    </button>
  );
}
