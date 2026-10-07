import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'bookmarks'));

export const tool: Tool = {
  name: 'bookmarks',
  title: 'Bookmarks',
  blurb: 'Tagged links, import and export',
  icon: '<path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/><path d="M9 8h6"/><path d="M9 11h4"/>',
  note: 'Runs in your browser: bookmarks are kept in this browser only (localStorage). Nothing is sent.',
  public: true,
  app,
};
