import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'tz'));

export const tool: Tool = {
  name: 'tz',
  title: 'Time zones',
  blurb: 'Compare world clocks',
  icon: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/>',
  note: 'Public. Runs in your browser; nothing is sent. Your zone list is kept in this browser.',
  public: true,
  app,
};
