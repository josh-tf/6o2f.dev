import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'hash'));

export const tool: Tool = {
  name: 'hash',
  title: 'Hash',
  blurb: 'MD5, SHA and HMAC',
  icon: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  note: 'Public. Text and files are hashed in your browser; nothing is sent.',
  public: true,
  app,
};
