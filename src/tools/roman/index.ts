import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'roman'));

export const tool: Tool = {
  name: 'roman',
  title: 'Numerals',
  blurb: 'Roman numerals, number words',
  icon: '<path d="M3 5h18M3 19h18"/><path d="M6 5v14"/><path d="m10 5 4 14 4-14"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
