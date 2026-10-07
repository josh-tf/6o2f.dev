import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'gitignore'));

export const tool: Tool = {
  name: 'gitignore',
  title: '.gitignore',
  blurb: 'Combine ignore templates',
  icon: '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/><circle cx="12" cy="15" r="3"/><path d="m9.9 17.1 4.2-4.2"/>',
  note: 'Public. Templates are built in; everything runs in your browser.',
  public: true,
  app,
};
