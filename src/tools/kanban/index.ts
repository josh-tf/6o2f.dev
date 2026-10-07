import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'kanban'));

export const tool: Tool = {
  name: 'kanban',
  title: 'Kanban',
  blurb: 'Boards, cards, drag and drop',
  icon: '<rect x="3" y="3" width="5" height="14" rx="1"/><rect x="10" y="3" width="5" height="9" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>',
  note: 'Runs in your browser: boards are kept in this browser only (localStorage), with JSON export. Nothing is sent.',
  public: true,
  app,
};
