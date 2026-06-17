import type { MetadataRoute } from "next";

// Web app manifest: makes BINGOChain installable and supplies the icon set in
// the formats browsers/OSes ask for (192 + 512). Next links this automatically.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "BINGOChain",
    short_name: "BINGOChain",
    description: "Strategic onchain bingo on Celo, staked in $LANCE.",
    start_url: "/",
    display: "standalone",
    background_color: "#010828",
    theme_color: "#010828",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
