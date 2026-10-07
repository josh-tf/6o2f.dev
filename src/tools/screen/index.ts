import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'screen'));

export const tool: Tool = {
  name: 'screen',
  title: 'This device',
  blurb: 'Screen, viewport and features',
  icon: '<rect x="2" y="4" width="14" height="10" rx="1.5"/><path d="M6 18h6M9 14v4"/><rect x="17" y="9" width="5" height="11" rx="1"/><path d="M19.5 17.5h.01"/>',
  note: 'Public: everything is read in your browser and nothing is sent.',
  public: true,
  app,
};
