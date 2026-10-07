import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'cidr'));

export const tool: Tool = {
  name: 'cidr',
  title: 'CIDR',
  blurb: 'IPv4/IPv6 subnet calculator',
  icon: '<rect x="9" y="2" width="6" height="5" rx="1"/><rect x="2" y="17" width="6" height="5" rx="1"/><rect x="16" y="17" width="6" height="5" rx="1"/><path d="M12 7v5M5 17v-3h14v3"/>',
  note: 'Public: all calculations run in your browser. Nothing is sent.',
  public: true,
  app,
};
