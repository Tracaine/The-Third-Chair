CREATE TABLE campaign_creation_requests (
  request_id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('PROCESSING','COMMITTED','FAILED')),
  campaign_id TEXT REFERENCES campaigns(id),
  error_json TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX campaign_creation_status_idx ON campaign_creation_requests(status, updated_at);
