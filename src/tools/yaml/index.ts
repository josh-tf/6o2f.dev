import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'yaml'));

export const tool: Tool = {
  name: 'yaml',
  title: 'YAML',
  blurb: 'YAML and JSON',
  icon: '<path d="M4 4h16v6H4zM4 14h9M4 18h6M16 14l2 2 3-3"/>',
  note: 'Public. Converts in your browser, nothing is uploaded.',
  public: true,
  app,
};
