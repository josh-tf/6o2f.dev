import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

// Client-only: all logic runs in public/_/jwt/app.js.
const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'jwt'));
app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export const tool: Tool = {
  name: 'jwt',
  title: 'JWT',
  blurb: 'Decode tokens',
  public: true,
  icon: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M16 7l3 3M14 9l2 2"/>',
  note: 'Runs in your browser. Nothing is sent.',
  app,
};
