import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'img'));

export const tool: Tool = {
  name: 'img',
  title: 'Images',
  blurb: 'Convert and resize images',
  icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
