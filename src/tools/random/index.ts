import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'random'));

export const tool: Tool = {
  name: 'random',
  title: 'Random',
  blurb: 'Dice, coins, lists, colors',
  icon: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1"/><circle cx="16" cy="8" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="8" cy="16" r="1"/><circle cx="16" cy="16" r="1"/>',
  note: "Public. Rolls use your browser's crypto RNG; nothing is sent.",
  public: true,
  app,
};
