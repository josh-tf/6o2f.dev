import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'regex'));

export const tool: Tool = {
  name: 'regex',
  title: 'Regex',
  blurb: 'Test patterns live',
  icon: '<path d="M17 3v10M12.2 5.5l9.6 5M21.8 5.5l-9.6 5"/><circle cx="6" cy="18" r="3"/>',
  note: 'Public. Matches in a browser worker, nothing is sent.',
  public: true,
  app,
};
