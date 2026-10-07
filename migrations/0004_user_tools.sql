-- Per-user tool access: '*' = every tool, otherwise a comma list of tool names (admins always get everything).
ALTER TABLE users ADD COLUMN tools TEXT NOT NULL DEFAULT '*';
