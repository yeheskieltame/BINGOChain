// JSON-LD structured data for rich search results. Renders Organization,
// WebSite, and VideoGame schemas so Google can show BINGOChain with a richer
// card and understand the site is a playable onchain game on Celo.
const SITE_URL = "https://bingochain.vercel.app";

const schema = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "BINGOChain",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    sameAs: ["https://github.com/yeheskieltame/BINGOChain"],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "BINGOChain",
    url: SITE_URL,
    description:
      "Provably-fair onchain bingo on Celo with commit-reveal sealed boards and verifiable winners.",
  },
  {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: "BINGOChain",
    url: SITE_URL,
    description:
      "Strategic multiplayer onchain bingo on Celo. Boards are sealed with a commit-reveal scheme, so every winner is verifiable on-chain with instant payouts and no house.",
    applicationCategory: "GameApplication",
    genre: ["Bingo", "Strategy", "Multiplayer", "Blockchain"],
    gamePlatform: ["Web", "MiniPay"],
    operatingSystem: "Web",
    playMode: "MultiPlayer",
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  },
];

export function JsonLd() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
