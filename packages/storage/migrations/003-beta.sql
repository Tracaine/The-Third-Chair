CREATE TABLE checkpoints (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  request_id TEXT NOT NULL,
  state_version INTEGER NOT NULL,
  label TEXT NOT NULL,
  reason TEXT NOT NULL,
  state_json TEXT NOT NULL,
  state_hash TEXT NOT NULL,
  rng_counter INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(campaign_id, request_id),
  UNIQUE(campaign_id, branch_id, label)
);

CREATE TABLE journals (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  state_version INTEGER NOT NULL,
  audience TEXT NOT NULL,
  journal_json TEXT NOT NULL,
  journal_hash TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY(campaign_id, state_version, audience)
);

CREATE TABLE exports (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  state_version INTEGER NOT NULL,
  mode TEXT NOT NULL CHECK(mode IN ('PLAYER_SAFE','FULL_PRIVATE')),
  request_id TEXT NOT NULL,
  path TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE(campaign_id, request_id)
);

ALTER TABLE turns ADD COLUMN kind TEXT NOT NULL DEFAULT 'GAME'
  CHECK(kind IN ('GAME','REWIND'));

CREATE INDEX checkpoints_campaign_version_idx
  ON checkpoints(campaign_id, state_version DESC);
