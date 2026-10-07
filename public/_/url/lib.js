// Pure URL helpers (no DOM): used by app.js and tested in src/tools/url/lib.test.ts.
export const encode = (s, full) => (full ? encodeURI : encodeURIComponent)(s);

/** Percent-decode; throws an Error naming the first malformed sequence. plus: treat + as a space (form style). */
export function decode(s, full, plus) {
  if (plus) s = s.replace(/\+/g, ' ');
  const bad = /%(?![0-9a-fA-F]{2})/.exec(s);
  if (bad)
    throw new Error(`Malformed percent sequence "${s.slice(bad.index, bad.index + 3)}" at position ${bad.index + 1}: % must be followed by two hex digits.`);
  try {
    return (full ? decodeURI : decodeURIComponent)(s);
  } catch {
    throw new Error('Percent sequences do not form valid UTF-8 (a multi-byte character is cut off or has bad bytes).');
  }
}

const dq = (s) => {
  try {
    return decode(s, false, true);
  } catch {
    return s.replace(/\+/g, ' ');
  }
}; // lenient: keep malformed text as is

export const parseQuery = (q) =>
  q
    .replace(/^\?/, '')
    .split('&')
    .filter(Boolean)
    .map((p) => {
      const i = p.indexOf('=');
      return i < 0 ? [dq(p), ''] : [dq(p.slice(0, i)), dq(p.slice(i + 1))];
    });

/** Split a URL into editable parts; throws on an invalid URL. */
export function parse(s) {
  const u = new URL(s.trim());
  return {
    protocol: u.protocol,
    auth: u.username ? u.username + (u.password ? ':' + u.password : '') + '@' : '',
    host: u.hostname,
    port: u.port,
    path: u.pathname,
    hash: u.hash,
    rows: parseQuery(u.search),
  };
}

/** Rebuild a URL; plus: write spaces in the query as + instead of %20. Repeated keys stay as separate rows. */
export function build(p, plus) {
  const e = (s) => {
    const r = encodeURIComponent(s);
    return plus ? r.replace(/%20/g, '+') : r;
  };
  const q = p.rows.map(([k, v]) => `${e(k)}=${e(v)}`).join('&');
  const hash = p.hash && !p.hash.startsWith('#') ? '#' + p.hash : p.hash;
  return `${p.protocol}${p.host ? '//' + p.auth + p.host + (p.port ? ':' + p.port : '') : ''}${p.path}${q ? '?' + q : ''}${hash === '#' ? '' : hash}`;
}
