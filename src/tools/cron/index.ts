import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'cron'));

export const tool: Tool = {
  name: 'cron',
  title: 'Cron',
  blurb: 'Explain schedules',
  icon: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6M5 4 3 6M19 4l2 2"/>',
  note: 'Public. Runs in your browser, nothing is sent.',
  public: true,
  app,
};
