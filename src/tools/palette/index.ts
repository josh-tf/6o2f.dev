import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'palette'));

export const tool: Tool = {
  name: 'palette',
  title: 'Palettes',
  blurb: 'Harmonies and image colours',
  icon: '<rect x="3" y="4" width="4" height="16" rx="1"/><rect x="10" y="4" width="4" height="16" rx="1"/><rect x="17" y="4" width="4" height="16" rx="1"/><path d="M3 15h4M10 11h4M17 8h4"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
