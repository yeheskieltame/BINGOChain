"use client";

import { useEffect } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { recordReferral } from "../lib/api";

const REF_KEY = "bingo:ref";
const DONE_PREFIX = "bingo:ref-done:";

/// Captures a `?ref=<address>` invite param into localStorage on load, then
/// records the referral once the invited wallet connects — one POST per address,
/// never self. Safe to mount once at the app shell.
export function useReferralCapture() {
  const { address } = useAccount();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const ref = new URLSearchParams(window.location.search).get("ref");
    if (ref && isAddress(ref)) localStorage.setItem(REF_KEY, ref.toLowerCase());
  }, []);

  useEffect(() => {
    if (!address || typeof window === "undefined") return;
    const me = address.toLowerCase();
    const ref = localStorage.getItem(REF_KEY);
    if (!ref || ref === me || localStorage.getItem(DONE_PREFIX + me)) return;
    recordReferral(ref, me)
      .then(() => localStorage.setItem(DONE_PREFIX + me, "1"))
      .catch(() => {});
  }, [address]);
}
