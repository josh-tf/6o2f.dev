// Secrets are set with `wrangler secret put`, not in wrangler.jsonc, so `wrangler types` only sees them when a local
// .dev.vars exists. Declaring them here keeps the typecheck working on a fresh clone (merges with the generated Env).
interface Env {
  DISCORD_CLIENT_SECRET: string;
  SESSION_SECRET: string;
}
