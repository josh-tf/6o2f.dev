-- Shared by every tool. Users are allowlisted: only Discord ids in this table (or ADMIN_IDS) may sign in.
CREATE TABLE users (
  id TEXT PRIMARY KEY,            -- Discord user id
  name TEXT, avatar TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, last_login_at INTEGER,
  sessions_after INTEGER NOT NULL DEFAULT 0
);
-- Personal API tokens for curl: "Authorization: Bearer 6o2f_<random>", stored as SHA-256 hex.
CREATE TABLE tokens (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, hash TEXT NOT NULL UNIQUE, created_at INTEGER NOT NULL, last_used_at INTEGER
);
-- Per-tool tables: each tool adds its own migration file (000N_<tool>.sql), prefixing tables with the tool name.
