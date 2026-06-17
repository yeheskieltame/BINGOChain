import { ImageResponse } from "next/og";

// Default share card for the site — brand + tagline + live network numbers.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "BINGOChain — onchain bingo on Celo";

const API = process.env.NEXT_PUBLIC_API_URL || "https://bingochain-api-production.up.railway.app";

export default async function Image() {
  let stats: { players?: number; games?: number; volume?: string } = {};
  try {
    stats = await fetch(`${API}/api/stats`, { cache: "no-store" }).then((r) => r.json());
  } catch {
    // render without numbers if the indexer is unreachable
  }

  const Stat = ({ label, value }: { label: string; value: string }) => (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", fontSize: 56, fontWeight: 800, color: "#E8B341" }}>{value}</div>
      <div style={{ display: "flex", fontSize: 26, color: "#A8A096", textTransform: "uppercase", letterSpacing: 2 }}>{label}</div>
    </div>
  );

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          backgroundColor: "#0A0908",
          backgroundImage: "radial-gradient(900px 520px at 50% -15%, rgba(232,179,65,0.18), transparent 60%)",
          color: "#F5F1E8",
          padding: "72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 100, fontWeight: 800, letterSpacing: -3 }}>
            <span style={{ color: "#E8B341" }}>BINGO</span>
            <span>Chain</span>
          </div>
          <div style={{ display: "flex", fontSize: 40, marginTop: 8, color: "#D9CBA8" }}>
            Strategic onchain bingo on Celo — staked in $LANCE
          </div>
        </div>

        <div style={{ display: "flex", gap: 72 }}>
          <Stat label="Players" value={String(stats.players ?? "—")} />
          <Stat label="Games" value={String(stats.games ?? "—")} />
          <Stat label="$LANCE vol" value={String(stats.volume ?? "—")} />
        </div>
      </div>
    ),
    { ...size },
  );
}
