CREATE TABLE vote_polls (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, question TEXT NOT NULL, options TEXT NOT NULL, multi INTEGER NOT NULL DEFAULT 0, show_results INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL, closes_at INTEGER NOT NULL);
CREATE INDEX vote_polls_user ON vote_polls (user_id, created_at);
CREATE TABLE vote_votes (poll_id TEXT NOT NULL, voter TEXT NOT NULL, choices TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (poll_id, voter));
