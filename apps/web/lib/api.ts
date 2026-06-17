// Client for the BINGOChain backend (Railway). Override with NEXT_PUBLIC_API_URL.
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://bingochain-api-production.up.railway.app";

export type Profile = {
  address: string;
  name: string | null;
  avatar_seed: string | null;
  avatar_url: string | null;
  bio: string | null;
};
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

export type ReferralInfo = {
  address: string;
  invitedCount: number;
  qualifiedInvites: number;
  earnedLance: string;
  pendingLance: string;
  invitedBy: string | null;
};
export type ReferralRow = { rank: number; address: string; name: string | null; invites: number };

// Dedicated nonce for confirming an inviter — the referree calls this, signs the
// returned message, then posts the signature to recordReferral.
export const getReferralNonce = (address: string) =>
  fetch(`${API_URL}/api/auth/referral-nonce/${address}`, { cache: "no-store" }).then(
    asJson<{ address: string; nonce: string }>,
  );

// SIWE-gated: the referree signs the nonce message proving wallet ownership, then
// posts the signature here to credit their inviter.
export async function recordReferral(referrer: string, referree: string, signature: string) {
  const res = await fetch(`${API_URL}/api/referral`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ referrer, referree, signature }),
  });
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(e.error || `api ${res.status}`);
  }
  return res.json() as Promise<{ ok: boolean; status: string }>;
}

export const getReferral = (address: string) =>
  fetch(`${API_URL}/api/referral/${address}`, { cache: "no-store" }).then(asJson<ReferralInfo>);

export const getReferralLeaderboard = (limit = 20) =>
  fetch(`${API_URL}/api/referrals/leaderboard?limit=${limit}`, { cache: "no-store" }).then(asJson<ReferralRow[]>);

export type Stats = { games: number; players: number; volume: string; prizesPaid: string };
export const getStats = () => fetch(`${API_URL}/api/stats`, { cache: "no-store" }).then(asJson<Stats>);

export type ArenaWinner = { address: string; name: string | null; prize: string };
export type ArenaDetail = {
  arenaId: string;
  match: {
    token: string;
    stake: string;
    prizePool: string;
    fee: string;
    winnerCount: number | null;
    createdAt: string | null;
    settledAt: string | null;
  };
  players: { address: string; name: string | null; outcome: string | null; prize: string }[];
  winners: ArenaWinner[];
  boards: { player: string; board: number[] }[];
};
export const getArena = (id: string) =>
  fetch(`${API_URL}/api/arena/${id}`, { cache: "no-store" }).then(asJson<ArenaDetail>);

export type Competition = {
  id: string;
  title: string;
  startsAt: string;
  endsAt: string;
  prizePerWinner: string | null;
  topN: number | null;
  token: string | null;
  status: "upcoming" | "live" | "past";
};
export const getCompetitions = () =>
  fetch(`${API_URL}/api/competitions`, { cache: "no-store" }).then(asJson<Competition[]>);
export const getCompetitionLeaderboard = (id: string) =>
  fetch(`${API_URL}/api/competitions/${id}/leaderboard`, { cache: "no-store" }).then(asJson<LeaderboardRow[]>);

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
