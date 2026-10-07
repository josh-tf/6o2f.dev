import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'password'));

export const tool: Tool = {
  name: 'password',
  title: 'Passwords',
  blurb: 'Passwords and passphrases',
  icon: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/><circle cx="12" cy="16" r="1"/>',
  note: 'Public. Generated in your browser; nothing is sent or stored.',
  public: true,
  app,
};
