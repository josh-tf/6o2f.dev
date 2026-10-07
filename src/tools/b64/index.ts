import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

// Client-only: all logic runs in public/_/b64/app.js.
const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'b64'));
app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export const tool: Tool = {
  name: 'b64',
  title: 'Base64',
  blurb: 'Encode and decode',
  public: true,
  icon: '<path d="m8 8-5 4 5 4M16 8l5 4-5 4M14 5l-4 14"/>',
  note: 'Runs in your browser. Nothing is sent.',
  app,
};
