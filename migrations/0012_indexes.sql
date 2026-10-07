-- Lookups by owner: token listing/cap (src/index.ts) and per-user hook listing / user deletion.
CREATE INDEX IF NOT EXISTS tokens_user ON tokens (user_id);
CREATE INDEX IF NOT EXISTS hook_endpoints_user ON hook_endpoints (user_id, created_at);
