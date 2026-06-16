// Client for the BINGOChain backend (Railway). Override with NEXT_PUBLIC_API_URL.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://bingochain-api-production.up.railway.app";

export type Profile = { address: string; name: string | null; avatar_seed: string | null; bio: string | null };
export type PlayerStats = { games: number; wins: number; volume: string; earnings: string };
export type PlayerMatch = {
  arenaId: string;
  outcome: string | null;
  prize: string;
  stake: string;
  token: string;
  at: string | null;
};
export type PlayerData = { address: string; profile: Profile | null; stats: PlayerStats | null; recent: PlayerMatch[] };
export type LeaderboardRow = {
  rank: number;
  address: string;
  name: string | null;
  games: number;
  wins: number;
  volume: string;
  earnings: string;
};

async function asJson<T>(res: Response): Promise<T> {
  if (!res.ok && res.status !== 404) throw new Error(`api ${res.status}`);
  return res.json() as Promise<T>;
}

export const getPlayer = (address: string) =>
  fetch(`${API_URL}/api/player/${address}`, { cache: "no-store" }).then(asJson<PlayerData>);

export const getLeaderboard = (limit = 50) =>
  fetch(`${API_URL}/api/leaderboard?limit=${limit}`, { cache: "no-store" }).then(asJson<LeaderboardRow[]>);

export const getNonce = (address: string) =>
  fetch(`${API_URL}/api/auth/nonce/${address}`, { cache: "no-store" }).then(asJson<{ nonce: string; message: string }>);

export async function putProfile(
  address: string,
  body: { name?: string; avatarSeed?: string; bio?: string; signature: string },
): Promise<Profile> {
  const res = await fetch(`${API_URL}/api/profile/${address}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error || `api ${res.status}`);
  }
  return res.json() as Promise<Profile>;
}
