import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'shadow'));

export const tool: Tool = {
  name: 'shadow',
  title: 'Shadow',
  blurb: 'Box and text shadows',
  icon: '<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M19 8v10a3 3 0 0 1-3 3H8"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
