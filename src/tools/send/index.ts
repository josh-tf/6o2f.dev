import { Hono } from 'hono';
import { fail, page, type AppEnv } from '../../auth.ts';
import type { Tool } from '../types.ts';
import { roomId } from './room-id.ts';

const app = new Hono<AppEnv>();
app.get('/', (c) => page(c, 'send'));

// Public signalling socket. Files never pass through here; the room only relays WebRTC handshake messages.
app.get('/ws', async (c) => {
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') return c.text('Expected a WebSocket upgrade', 426);
  const origin = c.req.header('origin'); // blocks cross-site WebSocket use; non-browser clients send none
  if (origin && origin !== new URL(c.req.url).origin) return c.text('Bad origin', 403); // also covers Origin: null
  const id = await roomId({ mode: c.req.query('mode'), code: c.req.query('code') }, c.req.header('cf-connecting-ip'), c.env.SESSION_SECRET);
  if (!id) fail(400, 'Use ?mode=nearby or ?code=<6 characters>');
  return c.env.SEND.get(c.env.SEND.idFromName(id!)).fetch(c.req.raw);
});

export const tool: Tool = {
  name: 'send',
  title: 'Send',
  blurb: 'Send files device to device',
  icon: '<path d="M7 7h13"/><path d="m16 3 4 4-4 4"/><path d="M17 17H4"/><path d="m8 13-4 4 4 4"/>',
  note: 'Public, no sign-in. Files go directly between browsers; the server only helps devices find each other.',
  public: true,
  app,
};
