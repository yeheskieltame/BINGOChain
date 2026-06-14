import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Providers } from "../components/Providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "BINGOChain",
  description: "Strategic onchain bingo on Celo — sealed boards, verifiable winners.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#facc15",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
