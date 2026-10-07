import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'svg'));

export const tool: Tool = {
  name: 'svg',
  title: 'SVG',
  blurb: 'Sanitise, shrink, preview SVG',
  icon: '<path d="m8 7-5 5 5 5"/><path d="m16 7 5 5-5 5"/><path d="M10 18c0-7 4-5 4-12"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
