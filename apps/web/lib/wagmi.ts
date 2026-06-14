import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { celo } from "./bingo";

/// MiniPay injects an EIP-1193 provider; the injected connector picks it up.
/// Falls back to any injected wallet (MetaMask, etc.) in a normal browser.
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
