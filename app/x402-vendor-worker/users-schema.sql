CREATE TABLE IF NOT EXISTS enrolled_users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT,
  wallet_address TEXT,
  agent_key TEXT,
  face_vector TEXT,
  world_nullifier TEXT,
  enrolled_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_enrolled_users_wallet ON enrolled_users (wallet_address);
