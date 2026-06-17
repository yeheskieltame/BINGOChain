"use client";

import { useEffect, useState } from "react";
import { API_URL } from "../lib/api";

export type ProfileLite = { name?: string; avatarUrl?: string };

/**
 * Batch-resolve display names + avatars for a set of addresses (one request,
 * cached by the sorted address set). Returns a lowercased-address → profile map;
 * addresses without a name or avatar are simply absent.
 */
export function useProfiles(addresses: readonly (string | undefined | null)[]): Record<string, ProfileLite> {
  const [map, setMap] = useState<Record<string, ProfileLite>>({});
  const key = Array.from(new Set(addresses.filter(Boolean).map((a) => (a as string).toLowerCase())))
    .sort()
    .join(",");

  useEffect(() => {
    if (!key) return;
    let on = true;
    fetch(`${API_URL}/api/profiles?addresses=${key}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows: Array<{ address: string; name: string | null; avatar_url?: string | null }>) => {
        if (!on) return;
        const m: Record<string, ProfileLite> = {};
        for (const row of rows) {
          const entry: ProfileLite = {};
          if (row.name) entry.name = row.name;
          if (row.avatar_url) entry.avatarUrl = row.avatar_url;
          if (entry.name || entry.avatarUrl) m[row.address.toLowerCase()] = entry;
        }
        setMap(m);
      })
      .catch(() => {});
    return () => {
      on = false;
    };
  }, [key]);

  return map;
}
