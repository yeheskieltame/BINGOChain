"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Wallet } from "lucide-react";
import { shortAddress } from "../lib/format";
import { isMiniPay } from "../lib/minipay";
import { Button } from "./ui/button";
import { PlayerAvatar } from "./PlayerAvatar";
import { useProfiles } from "../hooks/useProfiles";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const profiles = useProfiles(address ? [address] : []);
  const profile = address ? profiles[address.toLowerCase()] : undefined;
  const name = profile?.name;

  if (isConnected && address) {
    return (
      <Button
        variant="secondary"
        size="sm"
        onClick={() => disconnect()}
        className={name ? "text-gold-300" : "font-mono text-gold-300"}
      >
        <PlayerAvatar address={address} imageUrl={profile?.avatarUrl} size={18} />
        {name ?? shortAddress(address)}
      </Button>
    );
  }

  // MiniPay auto-connects and its listing rules forbid a connect button, so
  // never render one there (MiniPayAutoConnect handles the connection).
  if (isMiniPay()) return null;

  return (
    <Button size="sm" onClick={() => connect({ connector: connectors[0] })}>
      <Wallet />
      Connect
    </Button>
  );
}
