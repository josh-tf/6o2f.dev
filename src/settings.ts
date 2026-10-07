// Site settings changed from the admin panel. Read on hot paths (every tool request, sign-in), so cached per isolate.
// ponytail: 30 s per-isolate cache, so a change takes up to 30 s to reach every isolate; use KV or a DO if that matters.

export type ToolState = 'off' | 'maintenance';
export type Settings = { tools: Record<string, ToolState>; defaultTools: string };

const TTL = 30_000;
let cache: { at: number; s: Settings } | null = null;

export async function settings(env: Env): Promise<Settings> {
  if (cache && Date.now() - cache.at < TTL) return cache.s;
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all<{ key: string; value: string }>();
  const s: Settings = { tools: {}, defaultTools: '' };
  for (const r of results) {
    if (r.key.startsWith('tool:') && (r.value === 'off' || r.value === 'maintenance')) s.tools[r.key.slice(5)] = r.value;
    else if (r.key === 'default_tools') s.defaultTools = r.value;
  }
  cache = { at: Date.now(), s };
  return s;
}

/** Drop this isolate's copy (after the admin panel writes), so the admin sees the change at once. */
export const clearSettings = () => {
  cache = null;
};
