"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";

const REF_KEY = "bingo:ref";

/// Captures a `?ref=<address>` invite param into localStorage on load and exposes
/// the pending inviter so the UI can offer an explicit "Confirm inviter" action.
/// Recording is now SIWE-gated (the referree must sign), so we no longer auto-POST
/// on connect — that would silently fail or pop an unexpected wallet prompt.
/// The pending ref is hidden when it equals the connected wallet (never self).
export function useReferralCapture() {
  const { address } = useAccount();
  const [ref, setRef] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const param = new URLSearchParams(window.location.search).get("ref");
    if (param && isAddress(param)) localStorage.setItem(REF_KEY, param.toLowerCase());
    setRef(localStorage.getItem(REF_KEY));
  }, []);

  const clearPendingRef = useCallback(() => {
    if (typeof window !== "undefined") localStorage.removeItem(REF_KEY);
    setRef(null);
  }, []);

  // Non-self guard: a wallet can't be its own inviter.
  const pendingRef = ref && address && ref === address.toLowerCase() ? null : ref;

  return { pendingRef, clearPendingRef };
}
