import type { MetadataRoute } from "next";

const SITE_URL = "https://bingochain.vercel.app";

// Static routes worth indexing. Per-arena pages are dynamic and ephemeral, so
// they are left out; the lobby (/arenas) is the canonical entry to live games.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes: Array<[string, number]> = [
    ["/", 1],
    ["/arenas", 0.9],
    ["/how-to-play", 0.8],
    ["/competition", 0.7],
    ["/create", 0.6],
    ["/profile", 0.4],
    ["/terms", 0.3],
    ["/privacy", 0.3],
  ];
  return routes.map(([path, priority]) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    priority,
  }));
}
