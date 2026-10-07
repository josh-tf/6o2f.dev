import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'calc'));

export const tool: Tool = {
  name: 'calc',
  title: 'Calculator',
  blurb: 'Expressions and history',
  icon: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18.5h.01M12 18.5h.01M16 18.5h.01"/>',
  note: 'Public. Runs in your browser; nothing is sent. History stays in this browser.',
  public: true,
  app,
};
