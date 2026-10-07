import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'unicode'));

export const tool: Tool = {
  name: 'unicode',
  title: 'Unicode',
  blurb: 'Inspect every character',
  icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 8v4a4 4 0 0 0 8 0V8"/><path d="M8 18h8"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
