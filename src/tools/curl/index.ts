import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'curl'));

export const tool: Tool = {
  name: 'curl',
  title: 'cURL',
  blurb: 'curl to fetch, Python, Go, PHP',
  icon: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 10l3 2-3 2"/><path d="M11 15h3"/><path d="M16 9.5l2 2.5-2 2.5"/>',
  note: 'Public. Converts curl commands to code in your browser; nothing is sent.',
  public: true,
  app,
};
