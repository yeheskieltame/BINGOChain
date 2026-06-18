import Image from "next/image";
import Link from "next/link";

// $LANCE staking token + the BingoChain proxy, both on Celo mainnet.
const LANCE_TOKEN = "0xb70c9Cd73428Afe51eEEA832C49E8840D3f85cA2";
const BINGO_CONTRACT = "0x8bE7c07CCF9FF515d82D4c36aB4EB937941432f1";

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-cream/40">{title}</p>
      <ul className="space-y-2 text-sm text-cream/70">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="transition-colors hover:text-neon">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/// Global footer. Carries the in-app Terms / Privacy links MiniPay requires for
/// listing, plus an ownership disclaimer so players know this is an independent
/// dapp (not operated by MiniPay/Opera/Celo). Extra bottom padding clears the
/// floating mobile BottomNav.
export function Footer() {
  return (
    <footer className="border-t border-white/10 bg-navy/40 px-5 pb-28 pt-10 md:px-6 md:pb-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8 rounded-lg" />
              <span className="font-anton text-lg uppercase tracking-tight">
                <span className="text-gradient-gold">BINGO</span>
                <span className="text-foreground">Chain</span>
              </span>
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-cream/60">
              Strategic onchain bingo on Celo, staked in $LANCE. Sealed boards, verifiable winners.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            <FooterCol
              title="Play"
              links={[
                ["Arenas", "/arenas"],
                ["Create", "/create"],
                ["Cup", "/competition"],
                ["How to play", "/how-to-play"],
              ]}
            />
            <FooterCol title="Account" links={[["Profile", "/profile"]]} />
            <FooterCol
              title="Legal"
              links={[
                ["Terms", "/terms"],
                ["Privacy", "/privacy"],
              ]}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 border-t border-white/5 pt-6 text-xs leading-relaxed text-cream/45 md:flex-row md:items-center md:justify-between">
          <p className="max-w-2xl">
            BINGOChain is an independent application built on Celo. It is not operated by, affiliated with, or endorsed
            by MiniPay, Opera, or the Celo Foundation. Staking uses real digital assets and carries risk; play
            responsibly.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <a
              href={`https://celoscan.io/address/${BINGO_CONTRACT}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-neon"
            >
              Contract
            </a>
            <a
              href={`https://celoscan.io/token/${LANCE_TOKEN}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-neon"
            >
              $LANCE
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
