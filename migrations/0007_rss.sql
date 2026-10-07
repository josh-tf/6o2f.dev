CREATE TABLE rss_feeds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  created_at INTEGER NOT NULL,
  UNIQUE (user_id, url)
);
