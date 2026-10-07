import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'flex'));

export const tool: Tool = {
  name: 'flex',
  title: 'Flexbox',
  blurb: 'Flexbox playground, copy CSS',
  icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><rect x="5" y="8" width="4" height="8"/><rect x="10" y="8" width="9" height="8"/><path d="M12 12h5M15 10l2 2-2 2"/>',
  note: 'Runs in your browser. Nothing is sent or stored.',
  public: true,
  app,
};
