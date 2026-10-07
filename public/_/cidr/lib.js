// IPv4 / IPv6 maths on BigInt. An address is { v: 4|6, n: BigInt }.
const BITS = { 4: 32, 6: 128 };
const ones = (k) => (1n << BigInt(k)) - 1n;

function parse4(s) {
  const p = s.split('.');
  if (p.length !== 4) return null;
  let n = 0n;
  for (const x of p) {
    if (!/^\d{1,3}$/.test(x) || +x > 255 || (x.length > 1 && x[0] === '0')) return null; // leading zeros are ambiguous (octal in some tools)
    n = (n << 8n) | BigInt(x);
  }
  return n;
}
function parse6(s) {
  if (!/^[0-9a-f:.]+$/i.test(s) || s.includes(':::')) return null;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const n = parse4(v4[1]);
    if (n === null) return null;
    const tail = [Number(n >> 16n), Number(n & 0xffffn)].map((x) => x.toString(16));
    s = s.slice(0, -v4[1].length) + 'x';
    if (!/(^|:)x$/.test(s)) return null;
    s = s.replace(/x$/, tail.join(':'));
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const grp = (h) => (h === '' ? [] : h.split(':'));
  const a = grp(halves[0]),
    b = halves.length === 2 ? grp(halves[1]) : [];
  if ([...a, ...b].some((g) => !/^[0-9a-f]{1,4}$/i.test(g))) return null;
  const fill = 8 - a.length - b.length;
  if (halves.length === 2 ? fill < 1 : fill !== 0) return null;
  return [...a, ...Array(halves.length === 2 ? fill : 0).fill('0'), ...b].reduce((n, g) => (n << 16n) | BigInt(parseInt(g, 16)), 0n);
}

/** Parse an address ("10.0.0.1", "2001:db8::1", "[::1]", "fe80::1%eth0"). Returns { v, n } or null. */
export function parseIP(input) {
  const s = String(input ?? '')
    .trim()
    .replace(/^\[(.*)\]$/, '$1')
    .replace(/%[\w.-]+$/, '');
  if (!s) return null;
  if (s.includes(':')) {
    const n = parse6(s);
    return n === null ? null : { v: 6, n };
  }
  const n = parse4(s);
  return n === null ? null : { v: 4, n };
}

/** Format: dotted quad, or RFC 5952 compressed IPv6 (IPv4-mapped shown as ::ffff:a.b.c.d). */
export function fmt(n, v) {
  if (v === 4) return [24n, 16n, 8n, 0n].map((s) => String((n >> s) & 255n)).join('.');
  const g = Array.from({ length: 8 }, (_, i) => Number((n >> BigInt(112 - 16 * i)) & 0xffffn));
  if (n >> 32n === 0xffffn) return `::ffff:${fmt(n & ones(32), 4)}`;
  let best = -1,
    len = 0;
  for (let i = 0; i < 8;) {
    if (g[i]) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && !g[j]) j++;
    if (j - i > len && j - i > 1) {
      best = i;
      len = j - i;
    }
    i = j;
  }
  const h = g.map((x) => x.toString(16));
  return best < 0 ? h.join(':') : `${h.slice(0, best).join(':')}::${h.slice(best + len).join(':')}`;
}
/** Full, uncompressed IPv6 (0000:…) */
export const expand6 = (n) => Array.from({ length: 8 }, (_, i) => ((n >> BigInt(112 - 16 * i)) & 0xffffn).toString(16).padStart(4, '0')).join(':');

/** Parse "addr/prefix", "addr/255.255.255.0", or a bare address (= /32 or /128). Returns { v, addr, prefix, net, last } or { error }. */
export function parseCIDR(input) {
  const s = String(input ?? '').trim();
  if (!s) return { error: 'Enter an address or block, for example 192.168.1.0/24 or 2001:db8::/48.' };
  const [a, p, ...rest] = s.split(/\s*\/\s*|\s+/);
  if (rest.length) return { error: `"${s}" has too many parts. Use address/prefix.` };
  const ip = parseIP(a);
  if (!ip) return { error: `"${a}" is not a valid IPv4 or IPv6 address.` };
  const W = BITS[ip.v];
  let prefix = W;
  if (p !== undefined) {
    if (/^\d{1,3}$/.test(p)) prefix = +p;
    else if (ip.v === 4 && parse4(p) !== null) {
      const bs = parse4(p).toString(2).padStart(32, '0');
      if (!/^1*0*$/.test(bs)) return { error: `${p} is not a valid netmask (its 1 bits must be contiguous, like 255.255.255.0).` };
      prefix = bs.indexOf('0') < 0 ? 32 : bs.indexOf('0');
    } else return { error: `"/${p}" is not a prefix length.` };
    if (prefix > W) return { error: `IPv${ip.v} prefixes go up to /${W}.` };
  }
  const hostMask = ones(W - prefix),
    net = ip.n & ~hostMask & ones(W);
  return { v: ip.v, addr: ip.n, prefix, net, last: net | hostMask };
}
const cidrStr = (n, prefix, v) => `${fmt(n, v)}/${prefix}`;

const IN = (n, v, base, prefix) => {
  const b = parseCIDR(`${base}/${prefix}`);
  return b.v === v && (n & ~ones(BITS[v] - prefix) & ones(BITS[v])) === b.net;
};
const RANGES4 = [
  ['0.0.0.0', 8, 'This network ("unspecified")', 'reserved'],
  ['10.0.0.0', 8, 'Private (RFC 1918)', 'private'],
  ['100.64.0.0', 10, 'Carrier-grade NAT (RFC 6598)', 'private'],
  ['127.0.0.0', 8, 'Loopback', 'loopback'],
  ['169.254.0.0', 16, 'Link-local (APIPA)', 'linklocal'],
  ['172.16.0.0', 12, 'Private (RFC 1918)', 'private'],
  ['192.0.0.0', 24, 'IETF protocol assignments', 'reserved'],
  ['192.0.2.0', 24, 'Documentation (TEST-NET-1)', 'doc'],
  ['192.88.99.0', 24, '6to4 relay anycast (deprecated)', 'reserved'],
  ['192.168.0.0', 16, 'Private (RFC 1918)', 'private'],
  ['198.18.0.0', 15, 'Benchmarking (RFC 2544)', 'reserved'],
  ['198.51.100.0', 24, 'Documentation (TEST-NET-2)', 'doc'],
  ['203.0.113.0', 24, 'Documentation (TEST-NET-3)', 'doc'],
  ['224.0.0.0', 4, 'Multicast', 'multicast'],
  ['240.0.0.0', 4, 'Reserved (class E)', 'reserved'],
  ['255.255.255.255', 32, 'Limited broadcast', 'reserved'],
];
const RANGES6 = [
  ['::', 128, 'Unspecified', 'reserved'],
  ['::1', 128, 'Loopback', 'loopback'],
  ['::ffff:0:0', 96, 'IPv4-mapped', 'reserved'],
  ['64:ff9b::', 96, 'NAT64 (RFC 6052)', 'reserved'],
  ['100::', 64, 'Discard-only (RFC 6666)', 'reserved'],
  ['2001::', 32, 'Teredo', 'reserved'],
  ['2001:db8::', 32, 'Documentation', 'doc'],
  ['2002::', 16, '6to4', 'reserved'],
  ['fc00::', 7, 'Unique local (ULA, private)', 'private'],
  ['fe80::', 10, 'Link-local', 'linklocal'],
  ['ff00::', 8, 'Multicast', 'multicast'],
  ['2000::', 3, 'Global unicast', 'global'],
];
/** Special-purpose ranges an address/block falls in (most specific first) + class for IPv4. */
export function flags(n, v, prefix = BITS[v]) {
  const hits = (v === 4 ? RANGES4 : RANGES6).filter(([b, p]) => p <= prefix && IN(n, v, b, p)).sort((a, b) => b[1] - a[1]);
  const out = { labels: hits.map(([b, p, l, k]) => ({ label: l, kind: k, block: `${b}/${p}` })) };
  if (v === 4) {
    const o = Number(n >> 24n);
    out.class = o < 128 ? 'A' : o < 192 ? 'B' : o < 224 ? 'C' : o < 240 ? 'D (multicast)' : 'E (reserved)';
  }
  const kinds = new Set(hits.map((h) => h[3]));
  out.private = kinds.has('private');
  out.loopback = kinds.has('loopback');
  out.linklocal = kinds.has('linklocal');
  out.multicast = kinds.has('multicast');
  // IPv6: only 2000::/3 is global unicast; anything else unlisted is IETF-reserved space.
  out.public = v === 4 ? !hits.length : hits.length === 1 && hits[0][3] === 'global';
  return out;
}

/** Everything about a block. */
export function info(input) {
  const c = parseCIDR(input);
  if (c.error) return c;
  const { v, prefix, net, last, addr } = c,
    W = BITS[v],
    size = 1n << BigInt(W - prefix);
  const mask = ones(W) ^ ones(W - prefix);
  let first = net,
    lastHost = last,
    usable = size;
  if (v === 4 && prefix <= 30) {
    first = net + 1n;
    lastHost = last - 1n;
    usable = size - 2n;
  } // /31 (RFC 3021) and /32 have no network/broadcast
  // IPv6 has no broadcast: every address is usable (the all-zeros one is also the subnet-router anycast).
  return {
    v,
    prefix,
    addr,
    net,
    last,
    size,
    usable,
    first,
    lastHost,
    mask,
    cidr: cidrStr(net, prefix, v),
    hostBits: addr !== net,
    netmask: fmt(mask, v),
    wildcard: fmt(ones(W - prefix), v),
    broadcast: v === 4 && prefix <= 30 ? fmt(last, 4) : null,
    flags: flags(net, v, prefix),
    ptr: ptr(addr, v),
  };
}

/** Binary string grouped into octets (v4) or 16-bit groups (v6). */
export function binary(n, v) {
  const W = BITS[v],
    s = n.toString(2).padStart(W, '0'),
    g = v === 4 ? 8 : 16;
  return s.match(new RegExp(`.{${g}}`, 'g')).join(v === 4 ? '.' : ':');
}

/** Reverse-DNS name. */
export function ptr(n, v) {
  if (v === 4) return `${fmt(n, 4).split('.').reverse().join('.')}.in-addr.arpa`;
  return `${n.toString(16).padStart(32, '0').split('').reverse().join('.')}.ip6.arpa`;
}

/** Split a block into /newPrefix subnets. Returns { count, subnets: [cidr strings] (at most `limit`) } or { error }. */
export function split(input, newPrefix, limit = 256) {
  const c = parseCIDR(input);
  if (c.error) return c;
  const np = Number(newPrefix),
    W = BITS[c.v];
  if (!Number.isInteger(np) || np < c.prefix || np > W) return { error: `The new prefix must be between /${c.prefix} and /${W}.` };
  const count = 1n << BigInt(np - c.prefix),
    step = 1n << BigInt(W - np),
    subnets = [];
  for (let i = 0n; i < count && i < BigInt(limit); i++) subnets.push(cidrStr(c.net + i * step, np, c.v));
  return { count, subnets, step };
}

/** Largest CIDR blocks exactly covering [start, end]. */
export function rangeToCidrs(start, end, v) {
  const W = BITS[v],
    out = [];
  if (end < start) [start, end] = [end, start];
  while (start <= end) {
    let k = 0; // host bits of the block
    while (k < W && (start & ((1n << BigInt(k + 1)) - 1n)) === 0n && start + (1n << BigInt(k + 1)) - 1n <= end) k++;
    out.push(cidrStr(start, W - k, v));
    start += 1n << BigInt(k);
    if (out.length > 4096) break; // ponytail: cap pathological v6 ranges; at most 2*128 blocks in practice
  }
  return out;
}
/** "a - b" range text → CIDR list, or { error }. */
export function range(a, b) {
  if (!String(a ?? '').trim() || !String(b ?? '').trim()) return { error: 'Enter both the first and the last address.' };
  const x = parseIP(a),
    y = parseIP(b);
  if (!x || !y) return { error: `${!x ? `"${a}"` : `"${b}"`} is not a valid address.` };
  if (x.v !== y.v) return { error: 'Both ends must be the same IP version.' };
  return { v: x.v, cidrs: rangeToCidrs(x.n, y.n, x.v), size: (y.n > x.n ? y.n - x.n : x.n - y.n) + 1n };
}

/** Merge a list of CIDRs/addresses into the minimal covering set. Returns { cidrs, errors, before }. */
export function aggregate(text) {
  const items = String(text ?? '')
    .replace(/\s*-\s*/g, '-')
    .split(/[\s,;]+/)
    .map((t) => t.trim())
    .filter(Boolean);
  const errors = [],
    ranges = { 4: [], 6: [] };
  for (const t of items) {
    if (t.includes('-') && !t.includes('/')) {
      const [a, b] = t.split('-'),
        r = range(a, b);
      if (r.error) {
        errors.push(`${t}: ${r.error}`);
        continue;
      }
      const x = parseIP(a).n,
        y = parseIP(b).n;
      ranges[r.v].push([x < y ? x : y, x < y ? y : x]);
      continue;
    }
    const c = parseCIDR(t);
    if (c.error) errors.push(`${t}: ${c.error}`);
    else ranges[c.v].push([c.net, c.last]);
  }
  const cidrs = [];
  for (const v of [4, 6]) {
    const rs = ranges[v].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
      merged = [];
    for (const [s, e] of rs) {
      const m = merged[merged.length - 1];
      if (m && s <= m[1] + 1n) {
        if (e > m[1]) m[1] = e;
      } else merged.push([s, e]);
    }
    for (const [s, e] of merged) cidrs.push(...rangeToCidrs(s, e, v));
  }
  return { cidrs, errors, before: items.length - errors.length };
}

/** Is `ip` inside `block`? Returns { inside, ip, block } or { error }. */
export function contains(block, ip) {
  const c = parseCIDR(block);
  if (c.error) return c;
  const x = parseIP(ip);
  if (!x) return { error: `"${ip}" is not a valid address.` };
  if (x.v !== c.v) return { inside: false, reason: `IPv${x.v} address vs IPv${c.v} block` };
  return { inside: x.n >= c.net && x.n <= c.last };
}

/** IP → decimal / hex; or decimal / 0x hex integer → IP. Returns { ip, v, dec, hex } or { error }. */
export function convert(input, prefer = 0) {
  const s = String(input ?? '').trim();
  const ip = parseIP(s);
  if (ip) return { ip: fmt(ip.n, ip.v), v: ip.v, dec: ip.n.toString(), hex: `0x${ip.n.toString(16)}`, full: ip.v === 6 ? expand6(ip.n) : null };
  let n;
  try {
    if (/^(0x[0-9a-f]+|\d+)$/i.test(s)) n = BigInt(s);
  } catch {}
  if (n === undefined) return { error: `"${s}" is neither an IP address nor an integer (decimal or 0x hex).` };
  const v = prefer || (n <= ones(32) ? 4 : 6);
  if (n > ones(BITS[v])) return { error: `${s} is larger than the largest IPv${v} address.` };
  return { ip: fmt(n, v), v, dec: n.toString(), hex: `0x${n.toString(16)}`, full: v === 6 ? expand6(n) : null };
}

/** Human count: 16777216 → "16,777,216"; huge v6 counts as 2^n. */
export function count(n) {
  if (n < 10n ** 15n) return Number(n).toLocaleString('en-US');
  const k = n.toString(2).length - 1;
  return 1n << BigInt(k) === n ? `2^${k} (${n.toString().slice(0, 4).replace(/^(\d)/, '$1.')}e${n.toString().length - 1})` : n.toString();
}
