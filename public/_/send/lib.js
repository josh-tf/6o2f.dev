// Pure helpers for the Send tool (no DOM, no network) so node can test them.
export const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 32 symbols, no I/O/0/1, so `byte & 31` is unbiased
export const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/;
export const genCode = (rnd = (n) => crypto.getRandomValues(new Uint8Array(n))) => Array.from(rnd(6), (b) => ALPHABET[b & 31]).join('');
/** Normalises typed/pasted/hash input ('#abc-234', ' abc 234 ') to a valid code or null. */
export const parseCode = (s) => {
  const c = String(s ?? '')
    .replace(/^#/, '')
    .replace(/[\s-]/g, '')
    .toUpperCase();
  return CODE_RE.test(c) ? c : null;
};
export const rid = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => b.toString(16).padStart(2, '0')).join('');

const ADJ = ['Quick', 'Calm', 'Brave', 'Cosy', 'Eager', 'Gentle', 'Happy', 'Jolly', 'Keen', 'Lucky', 'Merry', 'Nimble', 'Proud', 'Silent', 'Sunny', 'Witty'];
const ANI = ['Fox', 'Otter', 'Panda', 'Koala', 'Heron', 'Lynx', 'Gecko', 'Falcon', 'Wombat', 'Badger', 'Newt', 'Owl', 'Seal', 'Stoat', 'Tapir', 'Yak'];
export const friendlyName = (rnd = Math.random) => `${ADJ[(rnd() * ADJ.length) | 0]} ${ANI[(rnd() * ANI.length) | 0]}`;

/** 'phone' | 'tablet' | 'desktop' | 'laptop' | 'other' from the user agent, a coarse pointer and the screen width. */
export function guessDevice(ua = '', coarse = false, width = 1280) {
  if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || (/Macintosh/.test(ua) && coarse)) return 'tablet';
  if (/iPhone|iPod|Android|Mobile/i.test(ua) || (coarse && width < 600)) return 'phone';
  if (/Windows|Macintosh|Linux|CrOS|X11/.test(ua)) return width >= 1900 ? 'desktop' : 'laptop';
  return 'other';
}

const CTRL = /[\u0000-\u001f\u007f-\u009f]/g;
export const sanitizeName = (s, max = 32) =>
  String(s ?? '')
    .replace(CTRL, '')
    .trim()
    .slice(0, max);
/** Safe file name: no path separators or control characters, no leading dots, at most 120 chars (extension kept), never empty. */
export function sanitizeFileName(s) {
  let n = String(s ?? '')
    .replace(CTRL, '')
    .replace(/[\\/]/g, '')
    .replace(/[:*?"<>|]/g, '_')
    .trim()
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '');
  if (n.length > 120) {
    const ext = /\.[\w-]{1,16}$/.exec(n)?.[0] ?? '';
    n = n.slice(0, 120 - ext.length) + ext;
  }
  return n || 'file';
}
/** 'a.txt' -> 'a (2).txt' when already in `taken`; adds the result to `taken`. */
export function uniqueName(name, taken) {
  const dot = name.lastIndexOf('.'),
    [stem, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  let out = name;
  for (let i = 2; taken.has(out.toLowerCase()); i++) out = `${stem} (${i})${ext}`;
  taken.add(out.toLowerCase());
  return out;
}
/** Transfer and file ids from a peer: they end up in HTML attributes, so only short alphanumerics are accepted. */
export const ID_RE = /^[a-z0-9]{1,16}$/i;
/** Validates an untrusted offer: <= max files, safe integer sizes, sanitised unique names. */
export function cleanOffer(files, max = 50) {
  const taken = new Set();
  return (Array.isArray(files) ? files : [])
    .slice(0, max)
    .filter((f) => f && typeof f.id === 'string' && ID_RE.test(f.id) && Number.isSafeInteger(f.size) && f.size >= 0)
    .map((f) => ({ id: f.id, name: uniqueName(sanitizeFileName(f.name), taken), size: f.size }));
}

/** Message size: min(sctp.maxMessageSize, 64 KiB), 16 KiB when unknown. */
export const chunkSize = (max) => (Number.isFinite(max) && max > 0 ? Math.min(max, 65536) : 16384);
/** [start, end) byte ranges covering `size` in `chunk`-sized pieces. */
export function* chunkRanges(size, chunk) {
  for (let a = 0; a < size; a += chunk) yield [a, Math.min(a + chunk, size)];
}

export function fmtBytes(n) {
  if (!(n >= 1024)) return `${n | 0} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < 3);
  return `${n.toFixed(n < 10 ? 2 : 1).replace(/\.?0+$/, '')} ${u[i]}`;
}
export const fmtSpeed = (bps) => `${fmtBytes(bps)}/s`;
export function fmtEta(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '--';
  sec = Math.ceil(sec);
  return sec < 60 ? `${sec}s` : sec < 3600 ? `${(sec / 60) | 0}m ${sec % 60}s` : `${(sec / 3600) | 0}h ${Math.round((sec % 3600) / 60)}m`;
}
/** Average speed (bytes/s) and ETA (s) from bytes done so far. */
export function rate(done, total, ms) {
  const speed = ms > 0 ? (done * 1000) / ms : 0;
  return { speed, eta: speed > 0 ? (total - done) / speed : Infinity };
}
