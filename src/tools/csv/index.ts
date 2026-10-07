import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'csv'));

export const tool: Tool = {
  name: 'csv',
  title: 'CSV',
  blurb: 'CSV and JSON',
  icon: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M3 15h18M9 4v16M15 4v16"/>',
  note: 'Public. Converts in your browser, nothing is uploaded.',
  public: true,
  app,
};
