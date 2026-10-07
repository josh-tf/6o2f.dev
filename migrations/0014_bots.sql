-- What flagged bots do (src/guard.ts): one row per bot IP (IPv6 /64) with counters, and a short per-request log
-- (first 50 requests per IP per day). Only IPs that hit a honeypot are recorded. Retention: ips 30 days, log 7 days.
CREATE TABLE bot_ips (ip TEXT PRIMARY KEY, first_at INTEGER NOT NULL, last_at INTEGER NOT NULL, hits INTEGER NOT NULL DEFAULT 0, traps INTEGER NOT NULL DEFAULT 0, maze INTEGER NOT NULL DEFAULT 0,
  day TEXT NOT NULL, day_hits INTEGER NOT NULL DEFAULT 0, country TEXT, ua TEXT, first_path TEXT, last_path TEXT, last_host TEXT);
CREATE INDEX bot_ips_last ON bot_ips (last_at);
CREATE TABLE bot_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, ip TEXT NOT NULL, host TEXT, method TEXT, path TEXT, kind TEXT NOT NULL);
CREATE INDEX bot_log_ip ON bot_log (ip, id);
CREATE INDEX bot_log_at ON bot_log (at);
