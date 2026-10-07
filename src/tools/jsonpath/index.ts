import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'jsonpath'));

export const tool: Tool = {
  name: 'jsonpath',
  title: 'JSONPath',
  blurb: 'Query JSON with JSONPath',
  icon: '<circle cx="5" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="19" r="2"/><path d="M6.5 6.5l4 4"/><path d="M13.5 13.5l4 4"/><path d="M5 7v10h5"/><path d="M19 5h-5v5"/>',
  note: 'Public. Runs JSONPath queries in your browser; nothing is sent.',
  public: true,
  app,
};
