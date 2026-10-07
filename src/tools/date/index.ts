import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'date'));

export const tool: Tool = {
  name: 'date',
  title: 'Dates',
  blurb: 'Add, diff, ISO week, age',
  icon: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M8 2v4"/><path d="M16 2v4"/><path d="M3 9h18"/><path d="M12 12v6"/><path d="M9 15h6"/>',
  note: 'Public. Runs in your browser; nothing is sent. Local time or UTC.',
  public: true,
  app,
};
