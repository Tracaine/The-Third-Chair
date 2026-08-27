CREATE TABLE schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  name TEXT NOT NULL,
  source_pack_hash TEXT NOT NULL,
  rng_seed BLOB NOT NULL CHECK(length(rng_seed) = 32),
  state_version INTEGER NOT NULL CHECK(state_version >= 0),
  current_state_json TEXT NOT NULL,
  current_state_hash TEXT NOT NULL,
  current_decision_json TEXT NOT NULL,
  active_branch_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','READ_ONLY','ARCHIVED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  parent_branch_id TEXT REFERENCES branches(id),
  fork_turn_id TEXT,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','ABANDONED')),
  created_at TEXT NOT NULL
);

CREATE TABLE turns (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  client_request_id TEXT NOT NULL,
  expected_state_version INTEGER NOT NULL,
  decision_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PROCESSING','PLANNED','RESOLVED','AWAITING_INPUT','COMMITTED','FAILED')),
  before_state_json TEXT NOT NULL,
  before_state_hash TEXT NOT NULL,
  locked_intents_json TEXT NOT NULL,
  model_profile_json TEXT,
  resolution_plan_json TEXT,
  resolutions_json TEXT,
  director_proposal_json TEXT,
  candidate_state_json TEXT,
  narration_json TEXT,
  next_decision_json TEXT,
  error_json TEXT,
  committed_state_version INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(campaign_id, client_request_id)
);

CREATE TABLE active_turns (
  campaign_id TEXT PRIMARY KEY REFERENCES campaigns(id),
  turn_id TEXT NOT NULL UNIQUE REFERENCES turns(id),
  reserved_state_version INTEGER NOT NULL,
  reserved_decision_id TEXT NOT NULL,
  reserved_at TEXT NOT NULL
);

CREATE TABLE turn_recovery_commands (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  turn_id TEXT NOT NULL REFERENCES turns(id),
  client_request_id TEXT NOT NULL,
  decision_id TEXT NOT NULL,
  expected_state_version INTEGER NOT NULL,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PROCESSING','COMMITTED','FAILED')),
  result_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(campaign_id, client_request_id),
  UNIQUE(turn_id, decision_id)
);

CREATE TABLE turn_events (
  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
  turn_id TEXT NOT NULL REFERENCES turns(id),
  status TEXT NOT NULL,
  payload_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX turns_campaign_status_idx ON turns(campaign_id, status);
CREATE INDEX turn_events_turn_idx ON turn_events(turn_id, sequence);
CREATE INDEX recovery_commands_turn_idx ON turn_recovery_commands(turn_id);
