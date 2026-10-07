import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'escape'));

export const tool: Tool = {
  name: 'escape',
  title: 'Escape',
  blurb: 'Escape strings for 12 languages',
  icon: '<path d="m9 4 6 16"/><path d="M4 5v4M7 5v4M17 15v4M20 15v4"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
