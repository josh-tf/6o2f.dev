import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'useragent'));

export const tool: Tool = {
  name: 'useragent',
  title: 'User agent',
  blurb: 'Parse UA strings, spot bots',
  icon: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21v-1a7 7 0 0 1 14 0v1"/><path d="M2 8h3M19 8h3"/>',
  note: 'Public: parsing runs in your browser. Nothing is sent.',
  public: true,
  app,
};
