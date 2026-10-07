import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'chmod'));

export const tool: Tool = {
  name: 'chmod',
  title: 'chmod',
  blurb: 'Permissions and umask',
  icon: '<path d="M7 11V8a5 5 0 0 1 9.6-2"/><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M9 16h.01M12 16h.01M15 16h.01"/>',
  note: 'Public: runs entirely in your browser. Nothing is sent.',
  public: true,
  app,
};
