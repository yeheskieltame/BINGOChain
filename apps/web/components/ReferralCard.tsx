"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import { Copy, Check, Share2, Users, Gift } from "lucide-react";
import { getReferral, getReferralNonce, recordReferral, type ReferralInfo } from "../lib/api";
import { useReferralCapture } from "../hooks/useReferralCapture";
import { shortAddress } from "../lib/format";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

// The referree signs this exact message to confirm their inviter — both addresses
// lowercased, real newlines. Must match the backend's messageFor() byte-for-byte.
const confirmMessage = (referree: string, referrer: string, nonce: string) =>
  `BINGOChain\n\nConfirm your inviter.\n\nAddress: ${referree}\nInviter: ${referrer}\nNonce: ${nonce}`;

/// Invite panel: the player's referral link (their address as ?ref=), a copy
/// button, a native share, and their invite + reward stats. If the player arrived
/// via someone's invite and hasn't been recorded yet, offers an explicit SIWE
/// "Confirm inviter" action — recording is now signature-gated.
export function ReferralCard() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { pendingRef, clearPendingRef } = useReferralCapture();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    if (address) getReferral(address).then(setInfo).catch(() => {});
  }, [address]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!address) return null;
  const link = typeof window !== "undefined" ? `${window.location.origin}/?ref=${address}` : `/?ref=${address}`;
  // Offer the confirm panel only when the player isn't already recorded as invited.
  const showConfirm = !info?.invitedBy && !!pendingRef;

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
  async function confirmInviter() {
    if (!address || !pendingRef) return;
    setConfirming(true);
    setConfirmMsg(null);
    try {
      const me = address.toLowerCase();
      const referrer = pendingRef.toLowerCase();
      const { nonce } = await getReferralNonce(me);
      const signature = await signMessageAsync({ message: confirmMessage(me, referrer, nonce) });
      await recordReferral(referrer, me, signature);
      clearPendingRef();
      refresh();
    } catch (e) {
      const m = e instanceof Error ? e.message : "error";
      setConfirmMsg(/reject|denied/i.test(m) ? "Signature cancelled" : `Failed: ${m}`);
    } finally {
      setConfirming(false);
    }
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

      {showConfirm && (
        <div className="glass space-y-3 rounded-xl border border-gold-400/30 p-4">
          <p className="text-sm leading-relaxed text-foreground">
            You were invited by <span className="font-mono text-gold-300">{shortAddress(pendingRef!)}</span> — confirm to
            credit them.
          </p>
          <div className="flex items-center gap-3">
            <Button onClick={confirmInviter} disabled={confirming} size="sm">
              {confirming ? "Sign in wallet…" : "Confirm inviter"}
            </Button>
            {confirmMsg && <span className="text-sm text-destructive">{confirmMsg}</span>}
          </div>
        </div>
      )}

      <div className="glass space-y-3 rounded-xl p-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Share your link — when a friend connects through it and plays, you earn 25 $LANCE per qualified invite.
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

        <div className="flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Gift className="size-3.5 text-gold-300" />
            Referral rewards
          </span>
          <div className="flex items-center gap-3 font-mono text-xs">
            <span className="text-muted-foreground">
              <span className="text-gold-300">{info?.qualifiedInvites ?? 0}</span> qualified
            </span>
            <span className="text-muted-foreground">
              <span className="text-gold-300">{info?.earnedLance ?? "0"}</span> earned
            </span>
            <span className="text-muted-foreground">
              <span className="text-gold-300">{info?.pendingLance ?? "0"}</span> pending
            </span>
          </div>
        </div>

        {info?.invitedBy && (
          <p className="text-xs text-muted-foreground">
            Invited by <span className="font-mono text-gold-300">{shortAddress(info.invitedBy)}</span>
          </p>
        )}
      </div>
    </section>
  );
}
