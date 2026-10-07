import { DurableObject } from 'cloudflare:workers';

const MAX_PEERS = 24,
  MAX_FRAME = 16 * 1024,
  RATE = 40,
  WINDOW = 5000;
const DEVICES = ['phone', 'tablet', 'desktop', 'laptop', 'other'];
type Peer = { id: string; name: string; device: string };
type Att = Peer & { joined: boolean; t: number; n: number };

const clean = (s: unknown) =>
  String(s ?? '')
    .replace(/[^\x20-\x7e\u00a0-\uffff]/g, '')
    .trim()
    .slice(0, 32);
const send = (ws: WebSocket, m: unknown) => {
  try {
    ws.send(JSON.stringify(m));
  } catch {}
};
const pub = ({ id, name, device }: Att): Peer => ({ id, name, device });

/** One instance per transfer room (nearby network or pairing code): relays WebRTC signalling between the peers in it.
 *  Hibernation API: peer state lives in each socket's attachment. No storage, content is never logged. */
export class SendRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }
  async fetch(req: Request) {
    if (req.headers.get('upgrade') !== 'websocket') return new Response('Expected a WebSocket upgrade', { status: 426 });
    const [client, server] = Object.values(new WebSocketPair());
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 8);
    this.ctx.acceptWebSocket(server, [id]);
    if (this.ctx.getWebSockets().length > MAX_PEERS) {
      server.close(1013, 'Room is full');
      return new Response(null, { status: 101, webSocket: client });
    }
    server.serializeAttachment({ id, name: '', device: 'other', joined: false, t: Date.now(), n: 0 } satisfies Att);
    send(server, { type: 'hello', id, peers: this.peers(id) });
    return new Response(null, { status: 101, webSocket: client });
  }
  peers(except?: string) {
    return this.ctx
      .getWebSockets()
      .map((w) => w.deserializeAttachment() as Att | null)
      .filter((a): a is Att => !!a?.joined && a.id !== except)
      .map(pub);
  }
  broadcast(m: unknown, except: string) {
    for (const w of this.ctx.getWebSockets()) if ((w.deserializeAttachment() as Att | null)?.id !== except) send(w, m); // all sockets, so a peer between hello and 'me' misses nothing
  }
  webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    if (typeof raw !== 'string') return ws.close(1003, 'Text frames only');
    if (raw.length > MAX_FRAME) return ws.close(1009, 'Message too big');
    const a = ws.deserializeAttachment() as Att;
    const now = Date.now();
    if (now - a.t > WINDOW) {
      a.t = now;
      a.n = 0;
    }
    if (++a.n > RATE) return ws.close(1008, 'Too many messages');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- untrusted client JSON, validated field by field below
    let m: any;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (m?.type === 'me') {
      const was = a.joined;
      a.name = clean(m.name) || 'Unknown';
      a.device = DEVICES.includes(m.device) ? m.device : 'other';
      a.joined = true;
      this.broadcast({ type: was ? 'update' : 'join', peer: pub(a) }, a.id);
    } else if (m?.type === 'signal' && a.joined && typeof m.to === 'string') {
      for (const w of this.ctx.getWebSockets(m.to)) send(w, { type: 'signal', from: a.id, data: m.data });
    }
    ws.serializeAttachment(a);
  }
  webSocketClose(ws: WebSocket) {
    this.left(ws);
  }
  webSocketError(ws: WebSocket) {
    this.left(ws);
  }
  left(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Att | null;
    try {
      ws.close();
    } catch {}
    if (a?.joined) this.broadcast({ type: 'leave', id: a.id }, a.id);
  }
}
