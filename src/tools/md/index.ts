import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'md'));

export const tool: Tool = {
  name: 'md',
  title: 'Markdown',
  blurb: 'Live preview',
  icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 15V9l3 3 3-3v6M17 9v6m-2.5-2.5L17 15l2.5-2.5"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
