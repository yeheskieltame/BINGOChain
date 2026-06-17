"use client";

import { useEffect, useState } from "react";

/// A dismissible, ad-style promo that cross-promotes Claudelance (the onchain
/// AI-agent marketplace BINGOChain is built on) and links to claudelance.xyz.
const KEY = "cl-promo-dismissed-v1";

export function ClaudelancePromo() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;
    const t = setTimeout(() => setShow(true), 1600);
    return () => clearTimeout(t);
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* ignore storage errors */
    }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="fixed bottom-24 right-4 z-40 max-w-[19rem] md:bottom-4">
      <div className="liquid-glass rounded-2xl p-4" />
    </div>
  );
}
