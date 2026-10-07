import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'jwtgen'));

export const tool: Tool = {
  name: 'jwtgen',
  title: 'JWT signer',
  blurb: 'Sign JWTs: HS, RS, ES',
  icon: '<path d="M4 20 14 10"/><path d="m14 10 3-7 4 4-7 3z"/><path d="M4 20h7"/><circle cx="17" cy="7" r=".5"/>',
  note: 'Public. Signs and verifies in your browser; secrets and keys are never sent.',
  public: true,
  app,
};
