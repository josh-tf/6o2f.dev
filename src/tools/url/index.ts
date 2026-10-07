import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

// Client-only: all logic runs in public/_/url/app.js.
const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'url'));
app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export const tool: Tool = {
  name: 'url',
  title: 'URL',
  blurb: 'Encode, decode, parse',
  icon: '<path d="M9 17H7a5 5 0 0 1 0-10h2M15 7h2a5 5 0 0 1 0 10h-2"/><path d="M8 12h2M14 12h2"/><path d="M12 4v3M12 17v3"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
