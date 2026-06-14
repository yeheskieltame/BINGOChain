import { formatUnits, parseUnits } from "viem";

/// Human-readable token amount, trimmed to `maxFractionDigits`.
export function formatAmount(value: bigint, decimals: number, maxFractionDigits = 4): string {
  const s = formatUnits(value, decimals);
  if (!s.includes(".")) return s;
  const [whole, frac] = s.split(".");
  const trimmed = frac.slice(0, maxFractionDigits).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

/// Parse a user-entered amount (e.g. "1.5") into base units for a token's decimals.
export function parseAmount(value: string, decimals: number): bigint {
  return parseUnits(value as `${number}`, decimals);
}

/// Shorten an address for display.
export function shortAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
