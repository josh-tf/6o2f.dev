import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'aspect'));

export const tool: Tool = {
  name: 'aspect',
  title: 'Aspect',
  blurb: 'Ratios, resize, crop, PPI',
  icon: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M6 9v-1h3M18 15v1h-3"/><path d="M7 16l10-8"/>',
  note: 'Runs in your browser. Nothing is sent or stored.',
  public: true,
  app,
};
