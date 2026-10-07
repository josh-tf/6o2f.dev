#!/usr/bin/env bash
# Parallel-safe local dev server: scripts/dev.sh <slot 0-9>  → http://localhost:$((8850+slot)), state in .wrangler/slot-<slot>.
# Reach a tool with:  curl -H 'x-host: paste.6o2f.dev' -H "authorization: Bearer 6o2f_devtoken0000000000000000" localhost:8850/...
# (apex = x-host: 6o2f.dev). Runs in the foreground; start it with run_in_background. Stop it with: kill $(cat .wrangler/slot-<slot>.pid)
set -euo pipefail
cd "$(dirname "$0")/.."
SLOT=${1:?slot}; PORT=$((8850 + SLOT)); STATE=.wrangler/slot-$SLOT
W="pnpm exec wrangler"
mkdir -p "$STATE"
$W d1 migrations apply DB --local --persist-to "$STATE" >/dev/null
$W d1 migrations apply MAILDB --local --persist-to "$STATE" >/dev/null
HASH=$(printf %s 6o2f_devtoken0000000000000000 | sha256sum | cut -d' ' -f1)
$W d1 execute DB --local --persist-to "$STATE" --command "INSERT OR IGNORE INTO users (id,name,is_admin,created_at) VALUES ('219517248388202498','dev',1,0); INSERT OR IGNORE INTO tokens (id,user_id,name,hash,created_at) VALUES ('dev','219517248388202498','dev','$HASH',0);" >/dev/null
echo $$ > "$STATE.pid"
exec $W dev --local --port "$PORT" --inspector-port $((9360 + SLOT)) --persist-to "$STATE"
