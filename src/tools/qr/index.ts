import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'qr'));

export const tool: Tool = {
  name: 'qr',
  title: 'QR code',
  blurb: 'QR codes, PNG and SVG',
  icon: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M20 20h1v1"/>',
  note: 'Runs in your browser. Nothing is sent.',
  public: true,
  app,
};
