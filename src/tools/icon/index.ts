import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'icon'));

export const tool: Tool = {
  name: 'icon',
  title: 'Icon maker',
  blurb: 'Favicon and app icons',
  icon: '<rect x="3" y="3" width="18" height="18" rx="5"/><path d="M12 8.5 13.3 11l2.7.4-2 1.9.5 2.7-2.5-1.3-2.5 1.3.5-2.7-2-1.9 2.7-.4z"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
