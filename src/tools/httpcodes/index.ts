import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'httpcodes'));

export const tool: Tool = {
  name: 'httpcodes',
  title: 'HTTP codes',
  blurb: 'Every status code explained',
  icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9v6M11 9v6M7 12h4"/><path d="M14 9h4M16 9v6"/>',
  note: 'Public: a reference that runs in your browser. Try it links open mock.6o2f.dev.',
  public: true,
  app,
};
