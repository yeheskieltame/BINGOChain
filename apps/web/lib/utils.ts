import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge conditional class names and de-dupe conflicting Tailwind utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Unwrap a viem / wallet error chain into the most specific human message.
 * viem wraps the real cause (a node revert reason, or a fee-currency / tx-type
 * complaint from a mobile wallet) under `.cause`, leaving a useless generic
 * `.shortMessage` like "An internal error was received." on top. Walk the chain
 * and prefer the deepest, most concrete detail so failures are actually legible.
 */
export function errText(e: unknown): string {
  const generic = /an internal error was received|internal json-rpc error/i;
  const found: string[] = [];
  let cur = e as Record<string, unknown> | undefined;
  const seen = new Set<unknown>();
  while (cur && typeof cur === "object" && !seen.has(cur)) {
    seen.add(cur);
    const data = cur.data as Record<string, unknown> | undefined;
    for (const v of [cur.reason, data?.message, cur.details, cur.shortMessage]) {
      if (typeof v === "string" && v.trim()) found.push(v.trim());
    }
    cur = cur.cause as Record<string, unknown> | undefined;
  }
  // Prefer the first specific (non-generic) message; fall back to anything.
  const specific = found.find((m) => !generic.test(m));
  return specific ?? found[0] ?? (e instanceof Error ? e.message : String(e));
}
