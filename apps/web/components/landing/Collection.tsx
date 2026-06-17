import Link from "next/link";
import { VideoBg } from "./VideoBg";

/// One arena card: a square autoplaying video + a glass overlay bar carrying a
/// commit-reveal fairness pillar and a circular CTA into the live lobby.
type Card = { video: string; value: string };

const CARDS: Card[] = [
  {
    video:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_053923_22c0a6a5-313c-474c-85ff-3b50d25e944a.mp4",
    value: "Sealed",
  },
  {
    video:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_054411_511c1b7a-fb2f-42ef-bf6c-32c0b1a06e79.mp4",
    value: "Onchain",
  },
  {
    video:
      "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260331_055427_ac7035b5-9f3b-4289-86fc-941b2432317d.mp4",
    value: "Verifiable",
  },
];

/// Section 3 — "Collection of Live arenas": a navy grid of three glass arena
/// cards. Each surfaces a commit-reveal fairness pillar over a looping video and
/// links into the live lobby (arenas staked in $LANCE).
export function Collection() {
  return (
    <section className="bg-navy">
      <div className="mx-auto max-w-[1831px] px-5 py-16 sm:px-8 md:px-12 md:py-24">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="font-anton text-[32px] uppercase leading-[1] text-cream sm:text-[44px] lg:text-[60px]">
            Collection of
            <span className="ml-12 block sm:ml-24 lg:ml-32">
              <span className="font-condiment normal-case text-neon">Live</span> arenas
            </span>
          </h2>

          <Link
            href="/arenas"
            className="group inline-flex flex-col text-cream transition-colors hover:text-neon"
          >
            <span className="flex items-end gap-3">
              <span className="font-anton text-[32px] uppercase leading-[0.85] sm:text-[44px] lg:text-[60px]">
                See
              </span>
              <span className="flex flex-col font-anton text-[20px] uppercase leading-[1] sm:text-[28px] lg:text-[36px]">
                <span>All</span>
                <span>Arenas</span>
              </span>
            </span>
            <span className="mt-2 h-1.5 w-full bg-neon sm:h-2.5" />
          </Link>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((card) => (
            <article
              key={card.value}
              className="liquid-glass rounded-[32px] p-[18px] transition-colors hover:bg-white/10"
            >
              <div className="relative overflow-hidden rounded-[24px] pb-[100%]">
                <VideoBg src={card.video} />
              </div>

              <div className="liquid-glass mt-[18px] flex items-center justify-between rounded-[20px] px-5 py-4">
                <div className="flex flex-col">
                  <span className="font-mono text-[11px] uppercase text-cream/70">BINGOChain</span>
                  <span className="font-anton text-[16px] uppercase text-cream">{card.value}</span>
                </div>

                <Link
                  href="/arenas"
                  aria-label={`Enter ${card.value} arenas`}
                  className="flex size-12 items-center justify-center rounded-full bg-gradient-to-br from-[#b724ff] to-[#7c3aed] text-white shadow-lg shadow-purple-500/50 transition hover:scale-110"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
