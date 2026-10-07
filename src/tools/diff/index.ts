import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

// Client-only: all logic runs in public/_/diff/app.js.
const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'diff'));
app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export const tool: Tool = {
  name: 'diff',
  title: 'Diff',
  blurb: 'Compare two texts',
  public: true,
  icon: '<path d="M6 3v12M18 9v12"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="6" r="3"/><path d="M13 6h-2a2 2 0 0 0-2 2v2M11 18h2a2 2 0 0 0 2-2v-2"/>',
  note: 'Runs in your browser. Nothing is sent.',
  app,
};
