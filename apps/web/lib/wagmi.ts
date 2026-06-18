import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { celo } from "viem/chains";

/// MiniPay injects an EIP-1193 provider; the injected connector picks it up.
/// Falls back to any injected wallet (MetaMask, etc.) in a normal browser.
/// We use viem's `celo` chain (not a bare defineChain) because it ships the
/// CIP-64 formatters/serializers, so a `feeCurrency` set on a transaction is
/// actually forwarded to the wallet — required for MiniPay to pay gas in cUSD.
/// Mainnet-only — there is no testnet chain configured by design.
export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [injected()],
  transports: {
    [celo.id]: http("https://forno.celo.org"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
