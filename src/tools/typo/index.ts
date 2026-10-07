import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'typo'));

export const tool: Tool = {
  name: 'typo',
  title: 'Type scale',
  blurb: 'Modular type scale generator',
  icon: '<path d="M3 20 8 5l5 15"/><path d="M5 15h6"/><path d="m15 20 3-8 3 8"/><path d="M16 18h4"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
