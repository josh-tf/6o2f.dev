import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

// Client-only: all logic runs in public/_/gradient/app.js.
const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'gradient'));
app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export const tool: Tool = {
  name: 'gradient',
  title: 'Gradient',
  blurb: 'CSS gradient maker',
  icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 15 15 3M3 21 21 3M9 21l12-12M15 21l6-6"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
