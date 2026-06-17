import { ImageResponse } from "next/og";

// Dynamic share card for an arena — when a link is shared, social previews render
// the result (winner + prize) or the open stake, on the brand's dark+gold look.
export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "BINGOChain arena";

const API = process.env.NEXT_PUBLIC_API_URL || "https://bingochain-api-production.up.railway.app";
const SYMBOLS: Record<string, string> = {
  "0xb70c9cd73428afe51eeea832c49e8840d3f85ca2": "$LANCE",
  "0x471ece3750da237f93b8e339c536989b8978a438": "CELO",
  "0x765de816845861e75a25fca122bb6898b8b1282a": "cUSD",
  "0xceba9300f2b948710d2653dd7b07f33a8b32118c": "USDC",
  "0x48065fbbe25f71c9282ddf5e1cd6d6a887483d5e": "USDT",
};
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let line = "Strategic onchain bingo on Celo";
  try {
    const d = await fetch(`${API}/api/arena/${id}`, { cache: "no-store" }).then((r) => r.json());
    const sym = SYMBOLS[(d?.match?.token ?? "").toLowerCase()] ?? "tokens";
    if (d?.winners?.length) {
      const w = d.winners[0];
      line = `Winner: ${w.name || short(w.address)}  ·  +${w.prize} ${sym}`;
    } else if (d?.match?.stake) {
      line = `Stake ${d.match.stake} ${sym}  ·  ${d?.players?.length ?? 0} players`;
    }
  } catch {
    // fall back to the generic tagline
  }

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
          backgroundImage: "radial-gradient(900px 500px at 75% -10%, rgba(232,179,65,0.18), transparent 60%)",
          color: "#F5F1E8",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", fontSize: 42, fontWeight: 800, letterSpacing: -1 }}>
          <span style={{ color: "#E8B341" }}>BINGO</span>
          <span>Chain</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "baseline", fontSize: 104, fontWeight: 800, letterSpacing: -3 }}>
            Arena <span style={{ color: "#E8B341", marginLeft: 24 }}>#{id}</span>
          </div>
          <div style={{ display: "flex", fontSize: 46, marginTop: 12, color: "#D9CBA8" }}>{line}</div>
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "#A8A096" }}>
          Sealed boards · verifiable winners · provably fair
        </div>
      </div>
    ),
    { ...size },
  );
}
