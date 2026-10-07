import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'cert'));

export const tool: Tool = {
  name: 'cert',
  title: 'Certificates',
  blurb: 'Decode X.509 and chains',
  icon: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M7 8h7M7 11h4"/><circle cx="16" cy="13" r="2.5"/><path d="m14.5 15.5-1 4.5 2.5-1.5 2.5 1.5-1-4.5"/>',
  note: 'Public. Certificates are decoded in your browser; nothing is sent.',
  public: true,
  app,
};
