"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

/**
 * Batch-resolve display names for a set of addresses (one request, cached by the
 * sorted address set). Returns a lowercased-address → name map; addresses
 * without a profile name are simply absent.
 */
export function useProfiles(addresses: readonly (string | undefined | null)[]): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({});
  const key = Array.from(new Set(addresses.filter(Boolean).map((a) => (a as string).toLowerCase())))
    .sort()
    .join(",");

  useEffect(() => {
    if (!key) return;
    let on = true;
    fetch(`${API_URL}/api/profiles?addresses=${key}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Array<{ address: string; name: string | null }>) => {
        if (!on) return;
        const m: Record<string, string> = {};
        for (const row of rows) if (row.name) m[row.address.toLowerCase()] = row.name;
        setMap(m);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [key]);

  return map;
}
