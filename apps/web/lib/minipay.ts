"use client";

import type { Address } from "viem";

// MiniPay (Opera Mini's in-app Celo wallet) injects an EIP-1193 provider with
// `isMiniPay = true`. It has two hard constraints a normal wagmi/viem setup
// violates, surfacing as an opaque "An internal error was received." (-32603):
//   1. It accepts ONLY legacy transactions (no EIP-1559 type-2).
//   2. It holds stablecoins, not CELO, so every tx must name a `feeCurrency` to
//      pay gas in (cUSD here) and you cannot send native CELO from it.
// So connected-wallet writes in MiniPay must carry `type: "legacy"` + a
// stablecoin `feeCurrency`. (This relies on the wagmi config using viem's `celo`
// chain, which ships the CIP-64 formatters that actually forward `feeCurrency`.)

/// cUSD on Celo mainnet - a direct fee currency MiniPay can pay gas in.
export const MINIPAY_FEE_CURRENCY: Address = "0x765DE816845861e75A25fCA122bb6898B8B1282a";

/// True when running inside the MiniPay in-app browser.
export function isMiniPay(): boolean {
  if (typeof window === "undefined") return false;
  const eth = (window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum;
  return !!eth?.isMiniPay;
}

/// Extra transaction params a connected-wallet write needs to succeed in MiniPay.
/// An empty object for every other wallet, so spreading it is a harmless no-op.
export function miniPayTx(): { type: "legacy"; feeCurrency: Address } | Record<string, never> {
  return isMiniPay() ? { type: "legacy", feeCurrency: MINIPAY_FEE_CURRENCY } : {};
}
