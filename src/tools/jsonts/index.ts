import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'jsonts'));

export const tool: Tool = {
  name: 'jsonts',
  title: 'JSON types',
  blurb: 'JSON to TS, Schema, Python, Go',
  icon: '<path d="M7 4H6a2 2 0 0 0-2 2v3.5a1.5 1.5 0 0 1-1.5 1.5 1.5 1.5 0 0 1 1.5 1.5V16a2 2 0 0 0 2 2h1"/><path d="M11 8h9"/><path d="M15.5 8v12"/><path d="M10 13l2 2-2 2"/>',
  note: 'Public. Generates types from sample JSON in your browser; nothing is sent.',
  public: true,
  app,
};
