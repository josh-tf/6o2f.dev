-- What the labyrinth cost each bot (src/guard.ts botEvent): bytes downloaded, words of filler, time held by the delay.
-- Rows from before these counters existed are backfilled with averages per request (2,330 bytes, 230 words, 2.25 s,
-- measured over 2,000 generated pages), assuming each got a page.
ALTER TABLE bot_ips ADD COLUMN bytes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bot_ips ADD COLUMN words INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bot_ips ADD COLUMN held_ms INTEGER NOT NULL DEFAULT 0;
UPDATE bot_ips SET bytes = hits * 2330, words = hits * 230, held_ms = hits * 2250;
-- Per logged request: the format it got (html, json, text; NULL = a 403) and how long it was held. Older rows: NULL.
ALTER TABLE bot_log ADD COLUMN fmt TEXT;
ALTER TABLE bot_log ADD COLUMN held_ms INTEGER;
