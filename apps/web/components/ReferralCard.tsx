"use client";

import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { Copy, Check, Share2, Users } from "lucide-react";
import { getReferral, type ReferralInfo } from "../lib/api";
import { shortAddress } from "../lib/format";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

/// Invite panel: the player's referral link (their address as ?ref=), a copy
/// button, a native share, and their invite count — the share carries a real
/// link a friend can paste to join and be counted as an invite.
export function ReferralCard() {
  const { address } = useAccount();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (address) getReferral(address).then(setInfo).catch(() => {});
  }, [address]);

  if (!address) return null;
  const link = typeof window !== "undefined" ? `${window.location.origin}/?ref=${address}` : `/?ref=${address}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }
  async function share() {
    const data = { title: "Play BINGOChain with me", text: "Join me on BINGOChain — onchain bingo on Celo, staked in $LANCE.", url: link };
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share(data);
      } catch {
        /* dismissed */
      }
      return;
    }
    copy();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">Invite friends</h2>
        <span className="inline-flex items-center gap-1.5 font-mono text-xs text-gold-300">
          <Users className="size-3.5" />
          {info?.invitedCount ?? 0} invited
        </span>
      </div>
      <div className="glass space-y-3 rounded-xl p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Share your link — when a friend connects through it, they’re counted as your invite.
        </p>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={link}
            onFocus={(e) => e.currentTarget.select()}
            className="h-10 font-mono text-xs"
            aria-label="Your referral link"
          />
          <Button variant="secondary" size="sm" onClick={copy} className="shrink-0">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <Button onClick={share} className="w-full">
          <Share2 className="size-4" />
          Share invite link
        </Button>
        {info?.invitedBy && (
          <p className="text-xs text-muted-foreground">
            Invited by <span className="font-mono text-gold-300">{shortAddress(info.invitedBy)}</span>
          </p>
        )}
      </div>
    </section>
  );
}
