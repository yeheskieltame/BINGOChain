import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BackButton } from "../../components/BackButton";
import { PageHeader } from "../../components/PageHeader";

export const metadata: Metadata = {
  title: "Privacy Policy — BINGOChain",
  description: "How BINGOChain handles your data.",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-cream/70">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-5 py-10 md:px-6">
      <BackButton />
      <PageHeader eyebrow="Legal" title="Privacy" accent="policy" />
      <p className="text-xs text-muted-foreground">Last updated June 2026.</p>

      <div className="space-y-7">
        <Section title="Overview">
          <p>
            BINGOChain is a non-custodial onchain game, so we collect as little as possible. Most of what makes the game
            work is public blockchain data, not data we hold about you.
          </p>
        </Section>

        <Section title="Information we process">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <span className="text-foreground">Wallet address.</span> When you connect, your public wallet address is
              used to read your on-chain game activity and show your stats.
            </li>
            <li>
              <span className="text-foreground">On-chain activity.</span> Your stakes, moves, wins, and settlements are
              recorded on the Celo blockchain. This data is public and permanent by design.
            </li>
            <li>
              <span className="text-foreground">Profile you choose to set.</span> An optional display name, short bio,
              and avatar you add to your profile. You can change or remove these at any time.
            </li>
            <li>
              <span className="text-foreground">Basic technical logs.</span> Standard server and analytics logs used to
              keep the service running and secure.
            </li>
          </ul>
        </Section>

        <Section title="What we do not do">
          <p>
            We never ask for or store your private keys or seed phrase. We do not require identity documents (no KYC),
            and we do not sell your data.
          </p>
        </Section>

        <Section title="Blockchain is public and permanent">
          <p>
            Anything written to the Celo blockchain (including your address, stakes, and results) is public and cannot be
            edited or deleted by us or anyone else. Please consider this before transacting.
          </p>
        </Section>

        <Section title="Third parties">
          <p>
            To function, the app relies on services such as Celo RPC providers (for example Forno), hosting and indexing
            infrastructure, and your wallet (for example MiniPay), which manages your keys under its own policies. Their
            handling of data is governed by their own terms.
          </p>
        </Section>

        <Section title="Your choices">
          <p>
            You control your wallet and can disconnect at any time. You can edit or clear the optional profile fields you
            set. On-chain records cannot be removed.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            Privacy questions:{" "}
            <a href="mailto:support@claudelance.xyz" className="text-gold-300 underline-offset-4 hover:underline">
              support@claudelance.xyz
            </a>
          </p>
        </Section>
      </div>
    </main>
  );
}
