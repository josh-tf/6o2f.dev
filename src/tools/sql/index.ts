import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'sql'));

export const tool: Tool = {
  name: 'sql',
  title: 'SQL',
  blurb: 'Format and minify SQL',
  icon: '<path d="M4 5a8 3 0 1 0 16 0a8 3 0 1 0-16 0"/><path d="M4 5v6c0 1.7 3.6 3 8 3"/><path d="M20 5v4"/><path d="M4 11v8c0 1.7 3.6 3 8 3"/><path d="M15 15l-2 2.5 2 2.5"/><path d="M19 15l2 2.5-2 2.5"/>',
  note: 'Public. Formats and minifies SQL in your browser; nothing is sent.',
  public: true,
  app,
};
