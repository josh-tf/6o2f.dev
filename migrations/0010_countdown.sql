CREATE TABLE countdown_events (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, title TEXT NOT NULL, target INTEGER NOT NULL, tz TEXT, message TEXT, created_at INTEGER NOT NULL);
CREATE INDEX countdown_events_user ON countdown_events (user_id, created_at);
