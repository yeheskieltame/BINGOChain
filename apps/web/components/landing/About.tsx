import { VideoBg } from "./VideoBg";

const ABOUT_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_151551_992053d1-3d3e-4b8c-abac-45f22158f411.mp4";

const BLURB =
  "A 5×5 board you seal before the game. Numbers are called in turn, onchain — and the winner is proven by replaying every move. Strategy over luck.";

/// Section 2 — full-bleed video intro: oversized Anton greeting with a cursive
/// Condiment accent, a mono blurb, and a row of faded decorative echoes.
export function About() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      <VideoBg src={ABOUT_VIDEO} />
      <div className="absolute inset-0 bg-navy/40" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1831px] flex-col px-5 py-16 sm:px-8 sm:py-20 md:px-12 lg:py-24">
        <div className="flex flex-col justify-between gap-10 lg:flex-row lg:gap-8">
          <div className="relative">
            <h2 className="font-anton text-[32px] uppercase leading-[1.05] text-cream sm:text-[44px] lg:text-[60px]">
              Hello!
              <br />
              I&apos;m BINGOChain
            </h2>
            <span className="font-condiment pointer-events-none absolute -bottom-3 right-0 -rotate-2 text-[36px] normal-case text-neon mix-blend-exclusion sm:text-[48px] lg:text-[68px]">
              Bingo
            </span>
          </div>

          <p className="max-w-[266px] font-mono text-[14px] uppercase leading-relaxed text-cream sm:text-[16px]">
            {BLURB}
          </p>
        </div>

        <div className="mt-auto flex justify-between gap-8 pt-16">
          <div className="flex flex-col gap-3">
            <p className="max-w-[266px] font-mono text-[14px] uppercase leading-relaxed text-cream opacity-40 sm:text-[16px]">
              {BLURB}
            </p>
            <p className="max-w-[266px] font-mono text-[14px] uppercase leading-relaxed text-cream opacity-40 sm:text-[16px]">
              {BLURB}
            </p>
          </div>

          <div className="hidden flex-col gap-3 lg:flex">
            <p className="max-w-[266px] font-mono text-[14px] uppercase leading-relaxed text-cream opacity-40 sm:text-[16px]">
              {BLURB}
            </p>
            <p className="max-w-[266px] font-mono text-[14px] uppercase leading-relaxed text-cream opacity-40 sm:text-[16px]">
              {BLURB}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
