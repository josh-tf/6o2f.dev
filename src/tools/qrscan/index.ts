import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'qrscan'));

export const tool: Tool = {
  name: 'qrscan',
  title: 'QR reader',
  blurb: 'Scan QR from image or camera',
  icon: '<path d="M3 8V4h4M17 4h4v4M21 16v4h-4M7 20H3v-4"/><rect x="7" y="7" width="4" height="4"/><path d="M14 7h3v3M7 14v3h3"/><path d="M3 12h18"/>',
  note: 'Runs in your browser. Images and camera frames are never uploaded.',
  public: true,
  app,
};
