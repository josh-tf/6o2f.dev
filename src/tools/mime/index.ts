import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'mime'));

export const tool: Tool = {
  name: 'mime',
  title: 'MIME types',
  blurb: 'Extensions, types, file sniffing',
  icon: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 13h1M14 13h1M9 17h6"/>',
  note: 'Public: runs in your browser. Files you check are read locally and never uploaded.',
  public: true,
  app,
};
