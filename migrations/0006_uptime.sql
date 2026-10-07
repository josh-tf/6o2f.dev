CREATE TABLE uptime_monitors (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_status INTEGER,
  last_ms INTEGER,
  last_checked INTEGER
);
CREATE INDEX uptime_monitors_user ON uptime_monitors (user_id);
CREATE TABLE uptime_checks (
  monitor_id TEXT NOT NULL,
  ts INTEGER NOT NULL,
  status INTEGER NOT NULL,
  ms INTEGER NOT NULL
);
CREATE INDEX uptime_checks_monitor_ts ON uptime_checks (monitor_id, ts);
CREATE INDEX uptime_checks_ts ON uptime_checks (ts);
