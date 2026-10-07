import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'hex'));

export const tool: Tool = {
  name: 'hex',
  title: 'Hex',
  blurb: 'Hex dump, convert, inspect',
  icon: '<path d="M12 2 21 7v10l-9 5-9-5V7z"/><path d="M8 10h8M8 14h8"/>',
  note: 'Runs in your browser. Files you open are read locally and never uploaded.',
  public: true,
  app,
};
