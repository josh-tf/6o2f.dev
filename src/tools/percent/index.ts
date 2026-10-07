import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'percent'));

export const tool: Tool = {
  name: 'percent',
  title: 'Percent',
  blurb: 'Change, reverse, discounts',
  icon: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  note: 'Public. Runs in your browser; nothing is sent.',
  public: true,
  app,
};
