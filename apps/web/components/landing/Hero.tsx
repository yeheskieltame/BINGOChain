import Image from "next/image";
import Link from "next/link";
import { VideoBg } from "./VideoBg";
import { SocialIcons } from "./SocialIcons";

const HERO_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_045634_e1c98c76-1265-4f5c-882a-4276f2080894.mp4";

const NAV: [string, string][] = [
  ["Home", "/"],
  ["Arenas", "/arenas"],
  ["Cup", "/competition"],
  ["How to play", "/how-to-play"],
  ["Profile", "/profile"],
];

/// Section 1 — full-bleed video hero: brand + glass nav + headline with a cursive
/// accent + entry CTA + social buttons.
export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden rounded-b-[32px]">
      <VideoBg src={HERO_VIDEO} />
      <div className="absolute inset-0 bg-navy/40" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1831px] flex-col px-5 py-7 sm:px-8 md:px-12">
        <header className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9 rounded-lg" priority />
            <span className="font-anton text-base uppercase tracking-wide text-cream">BINGOChain</span>
          </span>
          <nav className="liquid-glass hidden rounded-[28px] px-[52px] py-[24px] lg:block">
            <ul className="flex items-center gap-8">
              {NAV.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="font-anton text-[13px] uppercase tracking-wide text-cream transition-colors hover:text-neon">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <span className="hidden w-[120px] lg:block" aria-hidden />
        </header>

        <div className="relative flex flex-1 items-center">
          <div className="relative max-w-[780px] py-16 lg:ml-32">
            <h1 className="font-anton text-[40px] uppercase leading-[1.05] text-cream sm:text-[60px] sm:leading-[1] md:text-[75px] lg:text-[90px]">
              Seal your board
              <br />
              call the ( winning ) line
            </h1>
            <span className="font-condiment pointer-events-none absolute -right-2 top-1 -rotate-1 text-[24px] normal-case text-neon opacity-90 mix-blend-exclusion sm:text-[36px] md:right-4 lg:text-[48px]">
              onchain bingo
            </span>

            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link
                href="/arenas"
                className="liquid-glass rounded-[1rem] px-7 py-4 font-anton text-sm uppercase tracking-wide text-cream transition-colors hover:text-neon"
              >
                Enter the lobby →
              </Link>
              <Link
                href="/how-to-play"
                className="font-anton text-sm uppercase tracking-wide text-cream/70 underline-offset-4 transition-colors hover:text-neon hover:underline"
              >
                How to play
              </Link>
            </div>

            <SocialIcons orientation="horizontal" className="mt-10 justify-center lg:hidden" />
          </div>
        </div>
      </div>

      <SocialIcons className="absolute right-8 top-28 z-10 hidden lg:flex" />
    </section>
  );
}
