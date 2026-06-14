"use client";

import { useEffect, useState } from "react";
import { useConnect } from "wagmi";

/// Detects the MiniPay in-app browser (it injects `window.ethereum.isMiniPay`)
/// and auto-connects, since MiniPay expects dapps to connect without a button.
export function useMiniPay() {
  const [isMiniPay, setIsMiniPay] = useState(false);
  const { connect, connectors } = useConnect();

  useEffect(() => {
    const eth = (globalThis as { ethereum?: { isMiniPay?: boolean } }).ethereum;
    if (eth?.isMiniPay) {
      setIsMiniPay(true);
      const injected = connectors.find((c) => c.id === "injected" || c.type === "injected");
      if (injected) connect({ connector: injected });
    }
  }, [connect, connectors]);

  return { isMiniPay };
}
