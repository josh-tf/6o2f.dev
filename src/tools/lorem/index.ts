import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'lorem'));

export const tool: Tool = {
  name: 'lorem',
  title: 'Lorem',
  blurb: 'Placeholder text, seeded',
  icon: '<path d="M4 6h16M4 10h16M4 14h10M4 18h13"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
