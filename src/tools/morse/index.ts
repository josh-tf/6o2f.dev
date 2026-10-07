import { Hono } from 'hono';
import { page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'morse'));

export const tool: Tool = {
  name: 'morse',
  title: 'Morse',
  blurb: 'Text to Morse and audio',
  icon: '<circle cx="5" cy="12" r="1.5"/><path d="M10 12h4"/><path d="M18 12h3"/><path d="M4 5h2"/><path d="M10 5h6"/><path d="M4 19h6"/><circle cx="15" cy="19" r="1.5"/>',
  note: 'Public. Runs in your browser; audio and WAV are made locally and nothing is sent.',
  public: true,
  app,
};
