import { Mail, Twitter, Github } from "lucide-react";

const LINKS = [
  { icon: Mail, href: "mailto:hello@bingochain.xyz", label: "Email" },
  { icon: Twitter, href: "https://twitter.com", label: "Twitter" },
  { icon: Github, href: "https://github.com/yeheskieltame/BINGOChain", label: "GitHub" },
];

/// The three liquid-glass social buttons used in the hero + CTA sections.
/// Vertical by default (stacked in a corner); horizontal for the mobile row.
export function SocialIcons({
  orientation = "vertical",
  className = "",
}: {
  orientation?: "vertical" | "horizontal";
  className?: string;
}) {
  return (
    <div className={`flex ${orientation === "vertical" ? "flex-col" : "flex-row"} gap-3 ${className}`}>
      {LINKS.map(({ icon: Icon, href, label }) => (
        <a
          key={label}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          aria-label={label}
          className="liquid-glass flex size-14 items-center justify-center rounded-[1rem] text-cream transition-colors hover:bg-white/10"
        >
          <Icon className="size-5" />
        </a>
      ))}
    </div>
  );
}
