import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'tip'));

export const tool: Tool = {
  name: 'tip',
  title: 'Tip',
  blurb: 'Tip and split the bill',
  icon: '<path d="M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z"/><path d="M13 6v2M13 11v2M13 16v2"/>',
  note: 'Runs in your browser. Nothing is sent or stored.',
  public: true,
  app,
};
