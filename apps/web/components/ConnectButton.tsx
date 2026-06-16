"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Wallet } from "lucide-react";
import { shortAddress } from "../lib/format";
import { Button } from "./ui/button";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <Button variant="secondary" size="sm" onClick={() => disconnect()} className="font-mono text-gold-300">
        <span className="size-2 rounded-full bg-state-open shadow-[0_0_8px_hsl(var(--state-open))]" />
        {shortAddress(address)}
      </Button>
    );
  }

  return (
    <Button size="sm" onClick={() => connect({ connector: connectors[0] })}>
      <Wallet />
      Connect
    </Button>
  );
}
