CREATE TABLE IF NOT EXISTS outcomes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id TEXT NOT NULL,
  vendor_name TEXT,
  success INTEGER NOT NULL,
  latency_ms INTEGER,
  sla_status TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_outcomes_vendor ON outcomes (vendor_id, created_at);
