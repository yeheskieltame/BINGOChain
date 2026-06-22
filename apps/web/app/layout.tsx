import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Hanken_Grotesk, Geist_Mono, Anton, Condiment } from "next/font/google";
import { Providers } from "../components/Providers";
import { BottomNav } from "../components/BottomNav";
import { TopNav } from "../components/TopNav";
import { Footer } from "../components/Footer";
import { SpaceBackdrop } from "../components/SpaceBackdrop";
import { ClaudelancePromo } from "../components/ClaudelancePromo";
import { ReferralCapture } from "../components/ReferralCapture";
import { JsonLd } from "../components/JsonLd";
import "./globals.css";

// Premium Onchain type system: a characterful grotesque for display, a clean
// warm grotesque for UI, and a crisp tabular mono for on-chain numerals.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
// Cinematic landing fonts: Anton (bold display) + Condiment (cursive accent).
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const condiment = Condiment({ subsets: ["latin"], weight: "400", variable: "--font-condiment", display: "swap" });

const SITE_URL = "https://bingochain.vercel.app";
const SITE_NAME = "BINGOChain";
const TAGLINE = "Provably-fair onchain bingo on Celo";
const DESCRIPTION =
  "BINGOChain is provably-fair onchain bingo on Celo: commit-reveal sealed boards, verifiable winners, and instant onchain payouts. Strategic multiplayer bingo with no house and nothing to trust.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME}: ${TAGLINE}`,
    template: `%s | ${SITE_NAME}`,
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  category: "games",
  keywords: [
    "onchain bingo",
    "provably fair bingo",
    "blockchain bingo",
    "Celo game",
    "onchain gaming",
    "commit-reveal",
    "verifiable game",
    "web3 bingo",
    "crypto bingo",
    "multiplayer bingo onchain",
    "Celo dApp",
    "MiniPay game",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: `${SITE_NAME}: ${TAGLINE}`,
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME}: ${TAGLINE}`,
    description: DESCRIPTION,
  },
  // Talent Protocol (Proof of Ship) domain-ownership verification.
  other: {
    "talentapp:project_verification":
      "f5e12935118f8d7a84950cee739d4a9354c59ca2e6a89b249dc46b28e385f612306febe9a19b2c51c15a2d76a2d12536f5b1bc453bc20af745d400933e33f563",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#010828",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} ${anton.variable} ${condiment.variable}`}>
      <body>
        <JsonLd />
        <Providers>
          <SpaceBackdrop />
          <ReferralCapture />
          <TopNav />
          <div className="pb-10 md:pb-0">{children}</div>
          <Footer />
          <BottomNav />
          <ClaudelancePromo />
        </Providers>
      </body>
    </html>
  );
}
