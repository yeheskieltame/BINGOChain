import Link from "next/link";
import { VideoBg } from "./VideoBg";
import { SocialIcons } from "./SocialIcons";

const CTA_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_055729_72d66327-b59e-4ae9-bb70-de6ccb5ecdb0.mp4";

/// Section 4 — final CTA over a native-aspect video: cursive accent, a stacked
/// uppercase call-to-action, an entry link, and the social stack bottom-left.
export function Cta() {
  return (
    <section className="relative overflow-hidden bg-navy">
      {/* Native-aspect video defines the section height; content overlays it. */}
      <VideoBg src={CTA_VIDEO} cover={false} />
      <div className="absolute inset-0 bg-navy/30" />

      <div className="absolute inset-0 z-10 mx-auto flex max-w-[1831px] items-center justify-end px-5 sm:px-8 md:px-12 lg:pl-[15%] lg:pr-[20%]">
        <div className="relative text-right">
          <span className="font-condiment pointer-events-none absolute -left-2 -top-8 -rotate-3 text-[17px] normal-case text-neon opacity-90 mix-blend-exclusion sm:-top-12 md:text-[40px] lg:-top-20 lg:text-[68px]">
            Play onchain
          </span>
          <h2 className="font-anton text-[16px] uppercase leading-tight text-cream sm:text-[28px] md:text-[44px] lg:text-[60px]">
            <span className="mb-4 block sm:mb-6 lg:mb-12">Play now.</span>
            Seal your board.
            <br />
            Call the winning line.
            <br />
            Claim the pot.
          </h2>
          <Link
            href="/arenas"
            className="liquid-glass mt-6 ml-auto inline-block rounded-[1rem] px-7 py-4 font-anton text-sm uppercase tracking-wide text-cream transition-colors hover:text-neon"
          >
            Enter the lobby →
          </Link>
        </div>
      </div>

      <SocialIcons className="absolute bottom-[12%] left-[8%] z-10 lg:bottom-[20%]" />
    </section>
  );
}
