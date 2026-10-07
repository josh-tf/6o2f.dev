import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'html'));
app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export const tool: Tool = {
  name: 'html',
  title: 'HTML entities',
  blurb: 'Escape and unescape',
  icon: '<path d="m7 8-4 4 4 4M17 8l4 4-4 4"/><path d="M13.5 15.5 11 13c-1-1-.7-2.5.5-3s2.5.2 2.5 1.5c0 1.5-1.5 2.5-1.5 3.8 0 1 .8 1.7 1.8 1.7.8 0 1.5-.4 2-1.200"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
