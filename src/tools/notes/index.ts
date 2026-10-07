import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'notes'));

export const tool: Tool = {
  name: 'notes',
  title: 'Notes',
  blurb: 'Private offline scratchpad',
  icon: '<path d="M15 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h6"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  note: 'Public. Notes are stored only in this browser (localStorage); nothing is sent to a server.',
  public: true,
  app,
};
