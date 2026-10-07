import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'base'));

export const tool: Tool = {
  name: 'base',
  title: 'Bases',
  blurb: 'Hex, binary, any base',
  icon: '<path d="M6 8l2-2v12"/><ellipse cx="16.5" cy="12" rx="2.5" ry="5"/>',
  note: 'Public. Conversions run in your browser; nothing is sent.',
  public: true,
  app,
};
