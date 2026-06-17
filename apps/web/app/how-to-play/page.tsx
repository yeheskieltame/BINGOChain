import Link from "next/link";
import { LayoutGrid, Dices, Target, Eye, Trophy, ShieldCheck } from "lucide-react";
import { BackButton } from "../../components/BackButton";
import { Button } from "../../components/ui/button";

export const metadata = {
  title: "How to play — BINGOChain",
  description: "Learn BINGOChain: sealed boards, on-chain calls, and a winner proven by replay. Cheating is mathematically impossible.",
};

const STEPS = [
  {
    icon: LayoutGrid,
    title: "Join an arena",
    desc: "Pick an open arena and stake $LANCE. You get a random 5×5 board — but only its fingerprint (a hash) is sealed on-chain, not the board itself.",
  },
  {
    icon: Dices,
    title: "Call numbers in turn",
    desc: "Players take turns calling numbers 1–75. Every call is recorded on-chain, so the whole game is public and replayable.",
  },
  {
    icon: Target,
    title: "Hit BINGO",
    desc: "Mark called numbers on your board. Complete 5 lines — any rows, columns, or diagonals — then claim BINGO.",
  },
  {
    icon: Eye,
    title: "Reveal your board",
    desc: "After the round you reveal your real board and its secret salt. The contract checks it matches the fingerprint you committed at the start.",
  },
  {
    icon: Trophy,
    title: "Win in $LANCE",
    desc: "The winner is confirmed by replaying the game on-chain — no trust required — and the prize pool pays out in $LANCE.",
  },
];

export default function HowToPlayPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-5 py-10 md:px-6">
      <BackButton />
      <header className="space-y-2">
        <h1 className="font-display text-3xl font-black text-foreground md:text-4xl">How to play</h1>
        <p className="text-sm leading-relaxed text-muted-foreground md:text-base">
          BINGOChain is bingo you can&apos;t cheat at. Boards are sealed before the game and the winner is proven by
          replaying every move on-chain.
        </p>
      </header>

      <ol className="space-y-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <li key={s.title} className="glass flex gap-4 rounded-xl p-4">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold-400/10 font-display text-sm font-bold text-gold-300">
                {i + 1}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-gold-400" />
                  <h2 className="font-display font-bold text-foreground">{s.title}</h2>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="glass rounded-xl p-4">
        <p className="flex items-center gap-2 font-display text-sm font-bold text-gold-300">
          <ShieldCheck className="size-4" /> Provably fair
        </p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          When you join, only a hash of your board goes on-chain. You reveal the real board afterward and the contract
          verifies it against that hash — so no one can swap cards or fake a win. Cheating isn&apos;t blocked by a
          referee; it&apos;s mathematically impossible.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/arenas">Enter the lobby →</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/create">Create an arena</Link>
        </Button>
      </div>
    </main>
  );
}
