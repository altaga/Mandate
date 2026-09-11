CREATE TABLE IF NOT EXISTS used_payments (
  tx_hash TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL,
  used_at INTEGER NOT NULL
);
