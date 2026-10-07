-- Admin panel: site settings (tool on/off/maintenance, default grant for new sign-ins), user suspension,
-- an audit log of admin actions, and per-endpoint error counters for the Analytics errors view.
CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
ALTER TABLE users ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0;
CREATE TABLE admin_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, admin_id TEXT NOT NULL, action TEXT NOT NULL, target TEXT, detail TEXT);
CREATE INDEX admin_log_at ON admin_log (at);
ALTER TABLE stats_path ADD COLUMN e4 INTEGER NOT NULL DEFAULT 0;
ALTER TABLE stats_path ADD COLUMN e5 INTEGER NOT NULL DEFAULT 0;
