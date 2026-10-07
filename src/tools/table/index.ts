import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'table'));

export const tool: Tool = {
  name: 'table',
  title: 'Table',
  blurb: 'Markdown, HTML and text tables',
  icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16"/><path d="M13 14h4M13 17h2"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
