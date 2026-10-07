// Pure request -> response plan for /s/<status>. Returns an error string on bad input.
export type Plan = { status: number; delay: number; body: string | null; json: boolean; retry: string | null };

const enc = new TextEncoder();
const status = (v: string): number | string => {
  const n = /^\d{3}$/.test(v) ? Number(v) : NaN;
  if (n >= 100 && n < 200) return '1xx statuses cannot be sent by a Worker';
  return n >= 200 && n <= 599 ? n : 'status must be 200-599';
};
const num = (v: string | null, lo: number, hi: number, def: number) => {
  if (v === null || v === '') return def;
  const n = Number(v);
  return Number.isNaN(n) ? NaN : Math.min(hi, Math.max(lo, n));
};

export function plan(statusParam: string, q: URLSearchParams, rand = Math.random): Plan | string {
  let st = status(statusParam);
  const fc = status(q.get('failcode') || '500');
  const delay = num(q.get('delay'), 0, 10_000, 0);
  const fail = num(q.get('fail'), 0, 1, 0);
  const retry = num(q.get('retry'), 0, 86_400, -1);
  const type = q.get('type');
  const custom = q.get('body');
  if (typeof st === 'string') return st;
  if (typeof fc === 'string') return `failcode: ${fc}`;
  if (Number.isNaN(delay) || Number.isNaN(fail) || Number.isNaN(retry)) return 'delay, fail and retry must be numbers';
  if (type && type !== 'json' && type !== 'text') return 'type must be json or text';
  if (custom !== null && enc.encode(custom).length > 2048) return 'body is limited to 2048 bytes';
  if (rand() < fail) st = fc;
  return {
    status: st,
    delay,
    body: [204, 205, 304].includes(st) ? null : (custom ?? `{"status":${st},"ok":${st < 300}}`),
    json: type ? type === 'json' : custom === null,
    retry: retry >= 0 && (st === 429 || st === 503) ? String(Math.floor(retry)) : null,
  };
}
