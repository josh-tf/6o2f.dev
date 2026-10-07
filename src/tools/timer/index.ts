import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'timer'));

export const tool: Tool = {
  name: 'timer',
  title: 'Timer',
  blurb: 'Stopwatch, countdown',
  icon: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
  note: 'Public. Runs in your browser; nothing is sent. Timer state is kept in this browser.',
  public: true,
  app,
};
