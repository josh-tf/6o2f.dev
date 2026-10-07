import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'license'));

export const tool: Tool = {
  name: 'license',
  title: 'Licenses',
  blurb: 'Pick and fill a licence',
  icon: '<path d="M12 3v18"/><path d="M5 21h14"/><path d="M4 7h16"/><path d="m4 7-2.5 6a3 3 0 0 0 5 0z"/><path d="m20 7-2.5 6a3 3 0 0 0 5 0z"/>',
  note: 'Public. Runs in your browser. Not legal advice.',
  public: true,
  app,
};
