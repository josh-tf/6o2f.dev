import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

// Client-only: all logic runs in public/_/case/app.js.
const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'case'));
app.all('*', (c) => c.json({ error: 'Not found' }, 404));

export const tool: Tool = {
  name: 'case',
  title: 'Case',
  blurb: 'Convert text case',
  icon: '<path d="m2 18 5-12 5 12M4 13h6"/><circle cx="18" cy="15" r="3"/><path d="M21 12v6"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
