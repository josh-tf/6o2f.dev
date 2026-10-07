import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'blob'));

export const tool: Tool = {
  name: 'blob',
  title: 'Blobs',
  blurb: 'Random SVG blob shapes',
  icon: '<path d="M15.6 3.4c2.9.9 5.4 3.7 5 6.9-.3 2.4-2.3 3.6-2.6 6-.4 2.6-2.9 4.6-5.8 4.3-2.4-.3-3.5-2.1-5.8-2.5C3.6 17.6 2 15 2.6 12.2 3.1 9.7 5.4 8.9 6.6 6.6 8.1 3.8 12.3 2.4 15.6 3.4z"/><circle cx="10" cy="10" r="1.5"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
