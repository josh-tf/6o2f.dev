import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'grid'));

export const tool: Tool = {
  name: 'grid',
  title: 'CSS Grid',
  blurb: 'Build grid layouts, copy CSS',
  icon: '<rect x="3" y="3" width="11" height="7" rx="1"/><rect x="16" y="3" width="5" height="18" rx="1"/><rect x="3" y="12" width="5" height="9" rx="1"/><rect x="10" y="12" width="4" height="9" rx="1"/>',
  note: 'Runs in your browser. Nothing is sent or stored.',
  public: true,
  app,
};
