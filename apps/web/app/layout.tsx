import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Hanken_Grotesk, Geist_Mono, Anton, Condiment } from "next/font/google";
import { Providers } from "../components/Providers";
import { BottomNav } from "../components/BottomNav";
import { TopNav } from "../components/TopNav";
import { SpaceBackdrop } from "../components/SpaceBackdrop";
import { ClaudelancePromo } from "../components/ClaudelancePromo";
import { ReferralCapture } from "../components/ReferralCapture";
import "./globals.css";

// Premium Onchain type system: a characterful grotesque for display, a clean
// warm grotesque for UI, and a crisp tabular mono for on-chain numerals.
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display", display: "swap" });
const sans = Hanken_Grotesk({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });
// Cinematic landing fonts: Anton (bold display) + Condiment (cursive accent).
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-anton", display: "swap" });
const condiment = Condiment({ subsets: ["latin"], weight: "400", variable: "--font-condiment", display: "swap" });

export const metadata: Metadata = {
  title: "BINGOChain — onchain bingo on Celo",
  description: "Strategic onchain bingo on Celo — sealed boards, verifiable winners, staked in $LANCE.",
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
        <Providers>
          <SpaceBackdrop />
          <ReferralCapture />
          <TopNav />
          <div className="pb-24 md:pb-0">{children}</div>
          <BottomNav />
          <ClaudelancePromo />
        </Providers>
      </body>
    </html>
  );
}
