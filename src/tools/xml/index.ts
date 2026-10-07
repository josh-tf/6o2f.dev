import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'xml'));

export const tool: Tool = {
  name: 'xml',
  title: 'XML',
  blurb: 'Format, validate, XML ⇄ JSON',
  icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="M9.5 12.5 7.5 15l2 2.5"/><path d="M14.5 12.5l2 2.5-2 2.5"/><path d="M12.8 11.5l-1.6 7"/>',
  note: 'Public. Validates, formats and converts XML in your browser; nothing is sent.',
  public: true,
  app,
};
