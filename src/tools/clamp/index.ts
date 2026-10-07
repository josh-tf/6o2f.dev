import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'clamp'));

export const tool: Tool = {
  name: 'clamp',
  title: 'Fluid type',
  blurb: 'CSS clamp calculator',
  icon: '<path d="M3 20 21 4M3 20v-4M3 20h4M21 4v4M21 4h-4"/><path d="M8 20h2M14 20h2" />',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
