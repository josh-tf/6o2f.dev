import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'rot'));

export const tool: Tool = {
  name: 'rot',
  title: 'Ciphers',
  blurb: 'ROT13, Caesar, Vigenère',
  icon: '<circle cx="12" cy="12" r="9"/><path d="M12 3v4"/><path d="M8 15l4-8 4 8"/><path d="M9.5 12.5h5"/><path d="M17 18l2.5 2.5"/>',
  note: 'Public. Runs in your browser; nothing is sent. Classical ciphers are for puzzles, not security.',
  public: true,
  app,
};
