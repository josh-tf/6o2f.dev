import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'todo'));

export const tool: Tool = {
  name: 'todo',
  title: 'Todo',
  blurb: 'Checklist kept in your browser',
  icon: '<rect x="3" y="4" width="4" height="4" rx="1"/><rect x="3" y="14" width="4" height="4" rx="1"/><line x1="11" y1="6" x2="21" y2="6"/><line x1="11" y1="16" x2="21" y2="16"/><path d="m4 16 1 1 2-2"/>',
  note: 'Public. The list is stored only in this browser (localStorage); nothing is sent to a server.',
  public: true,
  app,
};
