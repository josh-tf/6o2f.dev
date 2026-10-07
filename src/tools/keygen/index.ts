import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'keygen'));

export const tool: Tool = {
  name: 'keygen',
  title: 'Key pairs',
  blurb: 'RSA, ECDSA, Ed25519 keys',
  icon: '<circle cx="6" cy="6" r="3"/><path d="M6 9v12M6 15h3M6 18.5h2"/><circle cx="18" cy="6" r="3"/><path d="M18 9v12M18 15h3M18 18.5h2"/>',
  note: 'Public. Keys are generated in your browser and never sent or stored.',
  public: true,
  app,
};
