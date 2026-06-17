import type { Config } from "tailwindcss";

/**
 * BINGOChain "Premium Onchain" design system.
 * Tokens are defined as HSL channel triples in app/globals.css and consumed
 * here with the `<alpha-value>` placeholder so every color supports Tailwind's
 * `/<opacity>` modifier (e.g. `bg-gold-400/10`, `text-state-open/80`).
 */
export default {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        "border-strong": "hsl(var(--border-strong) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        gold: {
          300: "hsl(var(--gold-300) / <alpha-value>)",
          400: "hsl(var(--gold-400) / <alpha-value>)",
          500: "hsl(var(--gold-500) / <alpha-value>)",
          600: "hsl(var(--gold-600) / <alpha-value>)",
          DEFAULT: "hsl(var(--gold-400) / <alpha-value>)",
        },
        // Cinematic landing palette (Orbis-style): deep navy, off-white, neon green.
        navy: "#010828",
        cream: "#EFF4FF",
        neon: "#6FFF00",
        state: {
          open: "hsl(var(--state-open) / <alpha-value>)",
          full: "hsl(var(--state-full) / <alpha-value>)",
          playing: "hsl(var(--state-playing) / <alpha-value>)",
          revealing: "hsl(var(--state-revealing) / <alpha-value>)",
          settled: "hsl(var(--state-settled) / <alpha-value>)",
          cancelled: "hsl(var(--state-cancelled) / <alpha-value>)",
        },
      },
      borderRadius: {
        sm: "calc(var(--radius) - 8px)",
        md: "calc(var(--radius) - 4px)",
        lg: "var(--radius)",
        xl: "calc(var(--radius) + 4px)",
        "2xl": "calc(var(--radius) + 8px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-anton)", "var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        anton: ["var(--font-anton)", "var(--font-display)", "system-ui", "sans-serif"],
        condiment: ["var(--font-condiment)", "cursive"],
      },
      boxShadow: {
        sm: "0 1px 2px 0 rgb(0 0 0 / 0.4)",
        md: "0 8px 24px -8px rgb(0 0 0 / 0.5)",
        lg: "0 16px 48px -12px rgb(0 0 0 / 0.6)",
        glow: "0 0 0 1px hsl(var(--gold-400) / 0.22), 0 10px 36px -10px hsl(var(--gold-400) / 0.3)",
      },
      backgroundImage: {
        "gold-sheen": "linear-gradient(135deg, hsl(var(--gold-300)), hsl(var(--gold-500)))",
        glass: "linear-gradient(180deg, rgb(255 255 255 / 0.05), rgb(255 255 255 / 0.012))",
      },
      keyframes: {
        "fade-rise": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "ring-pulse": {
          "0%": { transform: "scale(0.85)", opacity: "0.7" },
          "100%": { transform: "scale(1.7)", opacity: "0" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-rise": "fade-rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) both",
        "ring-pulse": "ring-pulse 0.9s ease-out forwards",
        shimmer: "shimmer 2.4s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
