import { DurableObject } from 'cloudflare:workers';

export type Captured = {
  seq: number;
  ts: number;
  method: string;
  path: string;
  headers: Record<string, string>;
  ip: string | null;
  body: string;
  encoding: 'text' | 'base64';
  truncated: boolean;
};
const KEEP = 100;

/** One instance per hook endpoint; stores the last N captured requests (SQLite-backed). */
export class HookInbox extends DurableObject<Env> {
  sql = this.ctx.storage.sql;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // AUTOINCREMENT keeps seq monotonic even after pruning/clearing.
    this.sql.exec(
      'CREATE TABLE IF NOT EXISTS req (seq INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER, method TEXT, path TEXT, headers TEXT, ip TEXT, body TEXT, encoding TEXT, truncated INTEGER)',
    );
  }
  add(r: Omit<Captured, 'seq'>) {
    this.sql.exec(
      'INSERT INTO req (ts, method, path, headers, ip, body, encoding, truncated) VALUES (?,?,?,?,?,?,?,?)',
      r.ts,
      r.method,
      r.path,
      JSON.stringify(r.headers),
      r.ip,
      r.body,
      r.encoding,
      r.truncated ? 1 : 0,
    );
    this.sql.exec('DELETE FROM req WHERE seq <= (SELECT MAX(seq) FROM req) - ?', KEEP);
  }
  list(since = 0): Captured[] {
    return (
      this.sql
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SQLite rows, mapped to Captured below
        .exec<Record<string, any>>('SELECT * FROM req WHERE seq > ? ORDER BY seq DESC LIMIT ?', since, KEEP)
        .toArray()
        .map((r) => ({ ...r, headers: JSON.parse(r.headers), truncated: !!r.truncated }) as Captured)
    );
  }
  clear() {
    this.sql.exec('DELETE FROM req');
  }
  async destroy() {
    await this.ctx.storage.deleteAll();
  }
}
