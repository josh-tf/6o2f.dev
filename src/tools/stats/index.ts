import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'stats'));

export const tool: Tool = {
  name: 'stats',
  title: 'Statistics',
  blurb: 'Mean, spread, quartiles',
  icon: '<path d="M3 3v18h18"/><rect x="6" y="12" width="3" height="6"/><rect x="11" y="7" width="3" height="11"/><rect x="16" y="10" width="3" height="8"/><path d="M5 9c3-6 9-6 15 0"/>',
  note: 'Runs in your browser. Nothing is sent or stored.',
  public: true,
  app,
};
