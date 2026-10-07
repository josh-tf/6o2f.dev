import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'color'));

export const tool: Tool = {
  name: 'color',
  title: 'Color',
  blurb: 'Convert, contrast, shades',
  icon: '<path d="M12 3a9 9 0 1 0 0 18c1.7 0 2.5-1 2-2.4-.5-1.4.3-2.6 1.8-2.6H18a3 3 0 0 0 3-3c0-5-4-10-9-10z"/><circle cx="7.5" cy="11" r="1"/><circle cx="12" cy="7.5" r="1"/><circle cx="16.5" cy="11" r="1"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
