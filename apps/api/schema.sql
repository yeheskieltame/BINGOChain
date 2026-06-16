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

-- Cursor for the on-chain indexer (last processed block per event scan).
CREATE TABLE IF NOT EXISTS indexer_state (
  id              text PRIMARY KEY,
  last_block      bigint NOT NULL DEFAULT 0,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_matches_player ON player_matches (player_address);
CREATE INDEX IF NOT EXISTS idx_player_stats_volume   ON player_stats (total_volume DESC);
