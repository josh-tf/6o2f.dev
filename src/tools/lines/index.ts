import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'lines'));

export const tool: Tool = {
  name: 'lines',
  title: 'Lines',
  blurb: 'Sort, dedupe, filter lines',
  icon: '<path d="m3 16 4 4 4-4"/><path d="M7 20V4"/><path d="M11 4h10M11 8h7M11 12h4"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
