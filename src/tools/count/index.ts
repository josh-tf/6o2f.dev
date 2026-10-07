import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

// Client-only: all logic runs in public/_/count/app.js.
const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'count'));
app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export const tool: Tool = {
  name: 'count',
  title: 'Counter',
  blurb: 'Words, chars, reading time',
  icon: '<path d="M4 9h16M4 15h16M10 3 8 21M16 3l-2 18"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
