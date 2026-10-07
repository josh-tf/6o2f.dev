import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'css'));

export const tool: Tool = {
  name: 'css',
  title: 'CSS',
  blurb: 'Beautify and minify CSS',
  icon: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M10.5 7 9 17"/><path d="M15.5 7 14 17"/><path d="M7.5 10.5h10"/><path d="M6.5 13.5h10"/>',
  note: 'Public. Beautifies and minifies CSS in your browser; nothing is sent.',
  public: true,
  app,
};
