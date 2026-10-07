import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'uuid'));

export const tool: Tool = {
  name: 'uuid',
  title: 'UUID',
  blurb: 'v4, v7, ULID, parser',
  icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="11" r="1.5"/><path d="M6 16c.5-1.5 1.5-2 2.5-2s2 .5 2.5 2M14 10h4M14 14h3"/>',
  note: 'Public. Ids are generated and parsed in your browser; nothing is sent.',
  public: true,
  app,
};
