import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'duration'));

export const tool: Tool = {
  name: 'duration',
  title: 'Durations',
  blurb: 'ISO 8601, h:m:s, phrases',
  icon: '<path d="M6 2h12"/><path d="M6 22h12"/><path d="M7 2c0 5 10 5 10 10S7 17 7 22"/><path d="M17 2c0 5-10 5-10 10s10 5 10 10"/>',
  note: 'Public. Runs in your browser; nothing is sent.',
  public: true,
  app,
};
