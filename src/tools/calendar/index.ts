import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'calendar'));

export const tool: Tool = {
  name: 'calendar',
  title: 'Calendar',
  blurb: 'Year view, ISO week numbers',
  icon: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M7 13h.01"/><path d="M12 13h.01"/><path d="M17 13h.01"/><path d="M7 17h.01"/><path d="M12 17h.01"/>',
  note: 'Public. Runs in your browser; nothing is sent.',
  public: true,
  app,
};
