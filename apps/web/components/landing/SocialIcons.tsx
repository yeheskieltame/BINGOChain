import { Mail } from "lucide-react";

// lucide-react 1.x dropped brand glyphs, so X + GitHub are inline SVGs (currentColor).
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-5" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

const LINKS = [
  { node: <Mail className="size-5" />, href: "mailto:support@claudelance.xyz", label: "Email support" },
  { node: <XIcon />, href: "https://x.com/Claudelanc0x", label: "Claudelance on X" },
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
      {LINKS.map(({ node, href, label }) => (
        <a
          key={label}
          href={href}
          target={href.startsWith("http") ? "_blank" : undefined}
          rel="noreferrer"
          aria-label={label}
          className="liquid-glass flex size-14 items-center justify-center rounded-[1rem] text-cream transition-colors hover:bg-white/10"
        >
          {node}
        </a>
      ))}
    </div>
  );
}
