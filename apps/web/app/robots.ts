import type { MetadataRoute } from "next";

const SITE_URL = "https://bingochain.vercel.app";

// Native Next.js robots route: allow full crawl and point bots at the sitemap.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
