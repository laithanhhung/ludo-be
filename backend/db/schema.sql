-- PostgreSQL schema for Ludo backend

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'room_status') THEN
    CREATE TYPE room_status AS ENUM ('waiting', 'playing', 'finished');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'match_status') THEN
    CREATE TYPE match_status AS ENUM ('active', 'finished', 'cancelled');
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) NOT NULL UNIQUE,
  display_name VARCHAR(64) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(12) NOT NULL UNIQUE,
  name VARCHAR(120) NOT NULL,
  status room_status NOT NULL DEFAULT 'waiting',
  max_slots SMALLINT NOT NULL DEFAULT 4 CHECK (max_slots BETWEEN 2 AND 8),
  created_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  current_player_index SMALLINT NOT NULL DEFAULT 0,
  dice_value SMALLINT NOT NULL DEFAULT 1 CHECK (dice_value BETWEEN 1 AND 6),
  turn INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_slots (
  id BIGSERIAL PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL CHECK (slot_index >= 0),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  player_name VARCHAR(64) NOT NULL DEFAULT '',
  joined BOOLEAN NOT NULL DEFAULT FALSE,
  ready BOOLEAN NOT NULL DEFAULT FALSE,
  socket_id VARCHAR(128) NULL,
  joined_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (room_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_room_slots_room_id ON room_slots(room_id);
CREATE INDEX IF NOT EXISTS idx_room_slots_socket_id ON room_slots(socket_id);

CREATE TABLE IF NOT EXISTS matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  status match_status NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ NULL,
  winner_slot_index SMALLINT NULL CHECK (winner_slot_index >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_matches_room_id ON matches(room_id);

CREATE TABLE IF NOT EXISTS match_players (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL CHECK (slot_index >= 0),
  player_name VARCHAR(64) NOT NULL,
  color_hex VARCHAR(16) NULL,
  start_index SMALLINT NOT NULL,
  home_level SMALLINT NOT NULL DEFAULT 1 CHECK (home_level BETWEEN 1 AND 4),
  skip_turn BOOLEAN NOT NULL DEFAULT FALSE,
  extra_rolls SMALLINT NOT NULL DEFAULT 0 CHECK (extra_rolls >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_id, slot_index)
);

CREATE INDEX IF NOT EXISTS idx_match_players_match_id ON match_players(match_id);

CREATE TABLE IF NOT EXISTS pawns (
  id BIGSERIAL PRIMARY KEY,
  match_player_id BIGINT NOT NULL REFERENCES match_players(id) ON DELETE CASCADE,
  pawn_code VARCHAR(16) NOT NULL,
  level SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 4),
  position INTEGER NULL,
  goal_lane_index SMALLINT NULL,
  shield_turns SMALLINT NOT NULL DEFAULT 0 CHECK (shield_turns >= 0),
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  finished BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (match_player_id, pawn_code)
);

CREATE INDEX IF NOT EXISTS idx_pawns_match_player_id ON pawns(match_player_id);

CREATE TABLE IF NOT EXISTS dice_rolls (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL CHECK (slot_index >= 0),
  turn_number INTEGER NOT NULL CHECK (turn_number > 0),
  value SMALLINT NOT NULL CHECK (value BETWEEN 1 AND 6),
  rolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dice_rolls_match_id_turn ON dice_rolls(match_id, turn_number);

CREATE TABLE IF NOT EXISTS challenge_questions (
  id INTEGER PRIMARY KEY,
  question TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  category VARCHAR(64) NULL,
  difficulty SMALLINT NULL CHECK (difficulty BETWEEN 1 AND 5),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_questions_active ON challenge_questions(is_active);

CREATE TABLE IF NOT EXISTS challenge_attempts (
  id BIGSERIAL PRIMARY KEY,
  match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  slot_index SMALLINT NOT NULL CHECK (slot_index >= 0),
  question_id INTEGER NOT NULL REFERENCES challenge_questions(id) ON DELETE RESTRICT,
  selected_option CHAR(1) NOT NULL CHECK (selected_option IN ('A', 'B', 'C', 'D')),
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_attempts_match_id ON challenge_attempts(match_id);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_rooms_updated_at ON rooms;
CREATE TRIGGER trg_rooms_updated_at
BEFORE UPDATE ON rooms
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_room_slots_updated_at ON room_slots;
CREATE TRIGGER trg_room_slots_updated_at
BEFORE UPDATE ON room_slots
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_matches_updated_at ON matches;
CREATE TRIGGER trg_matches_updated_at
BEFORE UPDATE ON matches
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_match_players_updated_at ON match_players;
CREATE TRIGGER trg_match_players_updated_at
BEFORE UPDATE ON match_players
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_pawns_updated_at ON pawns;
CREATE TRIGGER trg_pawns_updated_at
BEFORE UPDATE ON pawns
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_challenge_questions_updated_at ON challenge_questions;
CREATE TRIGGER trg_challenge_questions_updated_at
BEFORE UPDATE ON challenge_questions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

COMMIT;
