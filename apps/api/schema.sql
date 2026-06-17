-- BINGOChain backend schema. Idempotent — run on every boot.
-- Off-chain player identity + indexed on-chain game data (populated by the
-- indexer slice). On-chain stays the source of truth; this is a read cache +
-- the profile store (names/avatars/bio that have no on-chain home).

CREATE TABLE IF NOT EXISTS players (
  address     text PRIMARY KEY,           -- lowercased 0x address
  name        text,
  avatar_seed text,                       -- optional override for the identicon seed
  bio         text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS matches (
  arena_id     bigint PRIMARY KEY,
  token        text,
  stake        numeric,
  prize_pool   numeric,
  fee          numeric,
  winner_count integer,
  created_at   timestamptz,
  settled_at   timestamptz
);

CREATE TABLE IF NOT EXISTS player_matches (
  arena_id       bigint NOT NULL,
  player_address text   NOT NULL,
  outcome        text,                    -- win | loss | cancelled
  prize_won      numeric NOT NULL DEFAULT 0,
  PRIMARY KEY (arena_id, player_address)
);

CREATE TABLE IF NOT EXISTS player_stats (
  address        text PRIMARY KEY,
  games_played   integer NOT NULL DEFAULT 0,
  games_won      integer NOT NULL DEFAULT 0,
  total_volume   numeric NOT NULL DEFAULT 0,
  total_earnings numeric NOT NULL DEFAULT 0,
  last_game_at   timestamptz,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Competition events (Cup): a leaderboard is scoped to [starts_at, ends_at].
CREATE TABLE IF NOT EXISTS competitions (
  id               text PRIMARY KEY,
  title            text NOT NULL,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  prize_per_winner numeric,
  top_n            integer,
  token            text
);

-- Cursor for the on-chain indexer (last processed block per event scan).
CREATE TABLE IF NOT EXISTS indexer_state (
  id              text PRIMARY KEY,
  last_block      bigint NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Decoded revealed boards (from the revealBoard tx input) for post-game transparency.
CREATE TABLE IF NOT EXISTS revealed_boards (
  arena_id       bigint    NOT NULL,
  player_address text      NOT NULL,
  board          integer[] NOT NULL,
  PRIMARY KEY (arena_id, player_address)
);

-- Referrals: who invited whom. One inviter per invited wallet (referree is PK),
-- never self. Social-only in v1 — drives invite counts + a referral leaderboard;
-- no on-chain reward.
CREATE TABLE IF NOT EXISTS referrals (
  referree   text PRIMARY KEY,            -- the invited wallet (can be referred once)
  referrer   text NOT NULL,               -- the inviter wallet
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_matches_player ON player_matches (player_address);
CREATE INDEX IF NOT EXISTS idx_player_stats_volume   ON player_stats (total_volume DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer    ON referrals (referrer);
