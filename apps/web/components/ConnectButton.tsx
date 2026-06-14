"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { shortAddress } from "../lib/format";

export function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <button
        type="button"
        onClick={() => disconnect()}
        className="rounded-xl border border-neutral-700 px-3 py-2 font-mono text-sm text-yellow-400"
      >
        {shortAddress(address)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => connect({ connector: connectors[0] })}
      className="rounded-xl bg-yellow-400 px-4 py-2 font-semibold text-neutral-950 transition hover:bg-yellow-300"
    >
      Connect
    </button>
  );
}
