CREATE TABLE drop_files (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, size INTEGER NOT NULL, type TEXT,
  r2_key TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, downloads INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX drop_files_user ON drop_files (user_id, created_at);
CREATE INDEX drop_files_expires ON drop_files (expires_at);
