import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'draw'));

export const tool: Tool = {
  name: 'draw',
  title: 'Sketchpad',
  blurb: 'Draw, then export a PNG',
  icon: '<path d="M3 20c3-2 5 2 8 0s4-3 6-1"/><path d="m14 3 4 4-8 8H6v-4z"/>',
  note: 'Runs in your browser. Drawings autosave to this browser only.',
  public: true,
  app,
};
