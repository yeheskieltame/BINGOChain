"use client";

import { useReferralCapture } from "../hooks/useReferralCapture";

/// Headless: runs the referral capture/record effect at the app shell. Renders
/// nothing — just needs to live inside the wagmi provider tree.
export function ReferralCapture() {
  useReferralCapture();
  return null;
}
