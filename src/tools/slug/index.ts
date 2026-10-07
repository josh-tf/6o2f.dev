import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

// Client-only: all logic runs in public/_/slug/app.js.
const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'slug'));
app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export const tool: Tool = {
  name: 'slug',
  title: 'Slug',
  blurb: 'Make URL-safe slugs',
  icon: '<path d="M3 12h4M10 12h4M17 12h4"/><path d="m12 4-1 4M13 16l-1 4"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
