import type { Metadata } from "next";
import type { ReactNode } from "react";
import { BackButton } from "../../components/BackButton";
import { PageHeader } from "../../components/PageHeader";

export const metadata: Metadata = {
  title: "Terms of Use — BINGOChain",
  description: "The terms that govern your use of BINGOChain.",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-relaxed text-cream/70">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-5 py-10 md:px-6">
      <BackButton />
      <PageHeader eyebrow="Legal" title="Terms" accent="of use" />
      <p className="text-xs text-muted-foreground">Last updated June 2026.</p>

      <div className="space-y-7">
        <Section title="What BINGOChain is">
          <p>
            BINGOChain is a decentralized onchain bingo game deployed on the Celo blockchain (mainnet). Games are played
            by staking the $LANCE token. The application is a front-end that lets you interact directly with public smart
            contracts using your own self-custodial wallet. By connecting a wallet and playing, you agree to these terms.
          </p>
        </Section>

        <Section title="Eligibility and your responsibility">
          <p>
            You must be of legal age in your jurisdiction and permitted to take part in skill-based staking games where
            you live. You are solely responsible for complying with the laws that apply to you, and you must not use
            BINGOChain where it is prohibited. You are responsible for the security of the wallet you connect; only
            connect a wallet you control.
          </p>
        </Section>

        <Section title="Non-custodial and irreversible">
          <p>
            BINGOChain never takes custody of your funds or private keys. Stakes, payouts, and refunds are executed
            entirely by the smart contracts on Celo. Blockchain transactions are final and cannot be reversed, cancelled,
            or refunded by us. You are responsible for every transaction you sign.
          </p>
        </Section>

        <Section title="Fees and gameplay">
          <p>
            A protocol fee (currently 1%) is deducted from settled pots by the contract, and a network fee applies to
            every transaction. Game outcomes are determined on-chain and are publicly verifiable on Celoscan. Some arenas
            may be created and played by the operator for testing and validation; these are part of normal on-chain
            activity.
          </p>
        </Section>

        <Section title="Risks and no warranty">
          <p>
            Playing involves real digital assets whose value can change, and you may lose your entire stake. Smart
            contracts, front-end software, and blockchain networks can contain bugs or fail. The application is provided
            &quot;as is&quot; and &quot;as available&quot; with no warranties of any kind. To the maximum extent permitted
            by law, we are not liable for any loss arising from your use of BINGOChain.
          </p>
        </Section>

        <Section title="No affiliation">
          <p>
            BINGOChain is an independent project. It is not operated by, affiliated with, or endorsed by MiniPay, Opera,
            the Celo Foundation, or any wallet provider.
          </p>
        </Section>

        <Section title="Changes">
          <p>We may update these terms. Continued use after an update means you accept the revised terms.</p>
        </Section>

        <Section title="Contact">
          <p>
            Questions about these terms:{" "}
            <a href="mailto:yeheskielyunustame13@gmail.com" className="text-gold-300 underline-offset-4 hover:underline">
              yeheskielyunustame13@gmail.com
            </a>
          </p>
        </Section>
      </div>
    </main>
  );
}
