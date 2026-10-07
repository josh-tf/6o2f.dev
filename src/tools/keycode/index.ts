import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

// Client-only: all logic runs in public/_/keycode/app.js.
const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'keycode'));
app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export const tool: Tool = {
  name: 'keycode',
  title: 'Key codes',
  blurb: 'key, code and keyCode of any key',
  icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
