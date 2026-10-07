// Pure JSON helpers (browser + node tests).
// Position of the first syntax error (recursive descent over strict JSON); -1 if none. V8's own messages often lack a position.
function locate(t) {
  let i = 0;
  const ws = () => {
    while (' \t\n\r'.includes(t[i]) && i < t.length) i++;
  };
  const lit = (w) => {
    if (!t.startsWith(w, i)) throw i;
    i += w.length;
  };
  const val = () => {
    ws();
    const c = t[i];
    if (c === '{') {
      i++;
      ws();
      if (t[i] === '}') return void i++;
      for (;;) {
        ws();
        str();
        ws();
        if (t[i++] !== ':') throw i - 1;
        val();
        ws();
        if (t[i] === ',') {
          i++;
          continue;
        }
        if (t[i++] === '}') return;
        throw i - 1;
      }
    } else if (c === '[') {
      i++;
      ws();
      if (t[i] === ']') return void i++;
      for (;;) {
        val();
        ws();
        if (t[i] === ',') {
          i++;
          continue;
        }
        if (t[i++] === ']') return;
        throw i - 1;
      }
    } else if (c === '"') str();
    else if (c === 't') lit('true');
    else if (c === 'f') lit('false');
    else if (c === 'n') lit('null');
    else {
      const m = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?/.exec(t.slice(i));
      if (!m) throw i;
      i += m[0].length;
    }
  };
  const str = () => {
    if (t[i] !== '"') throw i;
    i++;
    for (; ; i++) {
      const c = t[i];
      if (c === undefined || c < ' ') throw i;
      if (c === '"') return void i++;
      if (c === '\\') {
        i++;
        if (!/["\\/bfnrtu]/.test(t[i] ?? '')) throw i;
      }
    }
  };
  try {
    val();
    ws();
    return i < t.length ? i : -1;
  } catch (e) {
    return typeof e === 'number' ? e : -1;
  }
}
export function parse(text) {
  try {
    return { value: JSON.parse(text) };
  } catch (e) {
    const m = String(e.message),
      at = Math.min(Math.max(locate(text), 0), text.length);
    const before = text.slice(0, at).split('\n');
    return {
      error: m.replace(/,\s*(\.\.\.)?"[\s\S]*" is not valid JSON$/, '').replace(/ in JSON at position \d+( \(line \d+ column \d+\))?/, ''),
      line: before.length,
      col: before.at(-1).length + 1,
      at,
    };
  }
}
export const sortKeys = (v) =>
  Array.isArray(v)
    ? v.map(sortKeys)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, sortKeys(v[k])]),
        )
      : v;
/** indent: 2, 4, '\t' or 0 (minify) */
export const stringify = (v, indent, sort) => JSON.stringify(sort ? sortKeys(v) : v, null, indent || undefined);
export const bytes = (s) => new TextEncoder().encode(s).length;

// Decimal value of a numeric literal as [digits without leading/trailing zeros, power of ten of the last kept digit].
const norm = (t) => {
  const [m, e = '0'] = t.replace(/^-/, '').toLowerCase().split('e'),
    [i, f = ''] = m.split('.');
  const d = (i + f).replace(/^0+/, ''),
    z = d.length - d.replace(/0+$/, '').length;
  return d ? `${d.slice(0, d.length - z)}e${+e - f.length + z}` : '0';
};
/** Count of numbers in the text that JSON.parse cannot hold exactly (integers past 2^53, long decimals); strings are skipped. */
export function lossy(text) {
  let n = 0;
  for (const m of text.matchAll(/"(?:[^"\\\n]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g)) {
    const t = m[0],
      v = Number(t);
    if (t[0] !== '"' && Number.isFinite(v) && norm(t) !== norm(String(v))) n++;
  }
  return n;
}
