"use client";

import { useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { isMiniPay } from "../lib/minipay";

/// MiniPay requires dApps to auto-connect on load - its docs say never show a
/// connect button. Inside MiniPay we eagerly connect the injected provider so
/// the player lands ready to play. In every other browser this is a no-op and
/// the normal ConnectButton flow is used unchanged.
export function MiniPayAutoConnect() {
  const { isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  useEffect(() => {
    if (!isMiniPay() || isConnected) return;
    const injected = connectors[0];
    if (injected) connect({ connector: injected });
  }, [isConnected, connect, connectors]);
  return null;
}
