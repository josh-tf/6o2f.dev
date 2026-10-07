import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'tree'));

export const tool: Tool = {
  name: 'tree',
  title: 'Tree',
  blurb: 'Folder tree from paths',
  icon: '<path d="M5 3v14a2 2 0 0 0 2 2h3"/><path d="M5 9h5"/><path d="M13 6h3l1.5 1.5H21V12h-8z"/><path d="M13 16h3l1.5 1.5H21V22h-8z"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
