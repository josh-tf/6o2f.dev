-- Usage analytics (aggregates only: no IP addresses or user agents are stored) and a login counter.
ALTER TABLE users ADD COLUMN logins INTEGER NOT NULL DEFAULT 0;
CREATE TABLE stats_daily (day TEXT NOT NULL, tool TEXT NOT NULL, hits INTEGER NOT NULL DEFAULT 0, err4 INTEGER NOT NULL DEFAULT 0, err5 INTEGER NOT NULL DEFAULT 0, ms INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, tool));
-- One row per anonymous visitor per day per tool: vh = hash(ip, user agent, day, secret). Pruned after 35 days.
CREATE TABLE stats_visitor (day TEXT NOT NULL, tool TEXT NOT NULL, vh TEXT NOT NULL, PRIMARY KEY (day, tool, vh));
-- kind: country | browser | device
CREATE TABLE stats_dim (day TEXT NOT NULL, kind TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, kind, key));
CREATE TABLE stats_path (day TEXT NOT NULL, tool TEXT NOT NULL, path TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, tool, path));
CREATE TABLE stats_user (day TEXT NOT NULL, user_id TEXT NOT NULL, tool TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, user_id, tool));
