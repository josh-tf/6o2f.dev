import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'totp'));

export const tool: Tool = {
  name: 'totp',
  title: 'TOTP codes',
  blurb: '2FA codes from a secret',
  icon: '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="M9 12h.01M12 12h.01M15 12h.01"/>',
  note: 'Public. Runs in your browser; secrets are never sent or stored unless you opt in.',
  public: true,
  app,
};
