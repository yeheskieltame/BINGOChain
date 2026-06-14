import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { celo, celoSepolia } from "./bingo";

/// MiniPay injects an EIP-1193 provider; the injected connector picks it up.
/// Falls back to any injected wallet (MetaMask, etc.) in a normal browser.
export const wagmiConfig = createConfig({
  chains: [celo, celoSepolia],
  connectors: [injected()],
  transports: {
    [celo.id]: http("https://forno.celo.org"),
    [celoSepolia.id]: http("https://forno.celo-sepolia.celo-testnet.org/"),
  },
  ssr: true,
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
