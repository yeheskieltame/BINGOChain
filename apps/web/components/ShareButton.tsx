"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Share2, Check } from "lucide-react";
import { Button } from "./ui/button";

/// Share the current page — native share sheet on mobile, copy-to-clipboard
/// everywhere else. Pairs with the dynamic OG card so the link previews nicely,
/// and carries the connected wallet as ?ref so any share doubles as an invite.
export function ShareButton({ title }: { title?: string }) {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);

  async function share() {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    if (address && !u.searchParams.get("ref")) u.searchParams.set("ref", address);
    const url = u.toString();
    const data = { title: title ?? "BINGOChain", text: title ?? "BINGOChain", url };
    if (navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        // user dismissed the share sheet — nothing to do
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard blocked — silently ignore
    }
  }

  return (
    <Button variant="secondary" size="sm" onClick={share}>
      {copied ? <Check className="size-4" /> : <Share2 className="size-4" />}
      {copied ? "Copied" : "Share"}
    </Button>
  );
}
