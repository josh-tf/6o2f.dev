// CSS parser, beautifier and minifier. Pure functions, no DOM.
// Strings, comments, url(...) and escapes are lexed properly, so ; { } inside them never split anything.

export class CssError extends Error {
  constructor(msg, at, src) {
    const before = src.slice(0, at),
      line = before.split('\n').length,
      col = at - before.lastIndexOf('\n');
    super(`${msg} (line ${line}, column ${col})`);
    Object.assign(this, { at, line, col });
  }
}

/** Index just past the token starting at i if it is a string, comment, url(...) or escape; otherwise -1. */
function skipAtom(src, i) {
  const c = src[i];
  if (c === '\\') return Math.min(src.length, i + 2);
  if (c === '/' && src[i + 1] === '*') {
    const e = src.indexOf('*/', i + 2);
    if (e < 0) throw new CssError('Unterminated comment', i, src);
    return e + 2;
  }
  if (c === '"' || c === "'") {
    for (let j = i + 1; j < src.length; j++) {
      if (src[j] === '\\') {
        j++;
        continue;
      }
      if (src[j] === c) return j + 1;
      if (src[j] === '\n') throw new CssError('Unterminated string', i, src);
    }
    throw new CssError('Unterminated string', i, src);
  }
  if ((c === 'u' || c === 'U') && /^url\(\s*[^\s"')]/i.test(src.slice(i, i + 64)) && !/[\w-]/.test(src[i - 1] ?? '')) {
    // unquoted url(...)
    for (let j = src.indexOf('(', i) + 1; j < src.length; j++) {
      if (src[j] === '\\') {
        j++;
        continue;
      }
      if (src[j] === ')') return j + 1;
    }
    throw new CssError('Unterminated url(', i, src);
  }
  return -1;
}

/** First index >= i of a char in `stops` at bracket depth 0 (with `{}` tracked too when braces=true). */
function scanTo(src, i, stops, braces = false) {
  let depth = 0;
  const open = braces ? '([{' : '([',
    close = braces ? ')]}' : ')]';
  while (i < src.length) {
    const e = skipAtom(src, i);
    if (e >= 0) {
      i = e;
      continue;
    }
    const c = src[i];
    if (depth === 0 && stops.includes(c)) return i;
    if (open.includes(c)) depth++;
    else if (close.includes(c)) {
      if (depth === 0) return i;
      depth--;
    }
    i++;
  }
  return i;
}

/**
 * Parse into nodes: { type: 'comment', text } | { type: 'decl', prop, value, important, custom }
 *   | { type: 'rule', selector, children } | { type: 'at', name, prelude, children | null }
 */
export function parse(src) {
  let i = 0;
  const n = src.length;
  const ws = () => {
    while (i < n && /\s/.test(src[i])) i++;
  };
  const block = (top) => {
    const out = [];
    for (;;) {
      ws();
      if (i >= n) {
        if (!top) throw new CssError('A "{" block is never closed', n, src);
        return out;
      }
      if (src.startsWith('/*', i)) {
        const e = skipAtom(src, i);
        out.push({ type: 'comment', text: src.slice(i, e) });
        i = e;
        continue;
      }
      if (src.startsWith('<!--', i) || src.startsWith('-->', i)) {
        i += src[i] === '<' ? 4 : 3;
        continue;
      } // legacy CDO/CDC
      const c = src[i],
        start = i;
      if (c === '}') {
        if (top) throw new CssError('Unexpected "}"', i, src);
        i++;
        return out;
      }
      if (c === ';') {
        i++;
        continue;
      }
      if (c === '@') {
        const m = /^@[\w-]+/.exec(src.slice(i, i + 100));
        if (!m) throw new CssError('Expected an at-rule name after "@"', i, src);
        i += m[0].length;
        const e = scanTo(src, i, '{;}');
        const prelude = src.slice(i, e);
        if (src[e] === '{') {
          i = e + 1;
          out.push({ type: 'at', name: m[0], prelude, children: block(false) });
        } else {
          i = src[e] === ';' ? e + 1 : e;
          out.push({ type: 'at', name: m[0], prelude, children: null });
        }
        continue;
      }
      const cm = /^--[\w-]*\s*:/.exec(src.slice(i, i + 300));
      if (cm && !top) {
        // custom property: the value may hold any balanced tokens, braces included
        i += cm[0].length;
        const e = scanTo(src, i, ';}', true);
        out.push(decl(cm[0].slice(0, -1).trim(), src.slice(i, e), true));
        i = src[e] === ';' ? e + 1 : e;
        continue;
      }
      const e = scanTo(src, i, '{;}');
      if (src[e] === '{') {
        const selector = src.slice(start, e);
        i = e + 1;
        out.push({ type: 'rule', selector, children: block(false) });
        continue;
      }
      const text = src.slice(start, e);
      i = src[e] === ';' ? e + 1 : e;
      const colon = scanTo(text, 0, ':');
      if (top || colon >= text.length)
        throw new CssError(top ? 'Expected a selector followed by "{"' : `Expected "property: value", found "${text.trim().slice(0, 40)}"`, start, src);
      out.push(decl(text.slice(0, colon).trim(), text.slice(colon + 1), false));
    }
  };
  const decl = (prop, raw, custom) => {
    let value = custom ? raw.trim() : raw,
      important = false;
    const m = /!\s*important\s*$/i.exec(value);
    if (m && !custom) {
      important = true;
      value = value.slice(0, m.index);
    } else if (custom && /!\s*important$/i.test(value)) {
      important = true;
      value = value.replace(/\s*!\s*important$/i, '');
    }
    return { type: 'decl', prop, value, important, custom };
  };
  return block(true);
}

/**
 * Normalise a raw chunk (selector, prelude or value): collapse whitespace outside strings/urls,
 * optionally drop comments, and in minify mode remove spaces that carry no meaning.
 */
function clean(raw, { comments = true, min = false, kind = 'value' } = {}) {
  let out = '',
    i = 0,
    space = false,
    attr = 0; // attr: inside [attr~=x], where ~ + > are not combinators
  const tight = kind === 'selector' ? ',>~+' : ',';
  const flushSpace = (next) => {
    if (!space) return;
    space = false;
    if (!out) return;
    if (out.at(-1) === '(' || next === ')') return;
    if (min && (tight.includes(out.at(-1)) || tight.includes(next) || (kind !== 'selector' && next === '!'))) return;
    if (!min && kind === 'value' && next === ',') return; // "a , b" -> "a, b"
    out += ' ';
  };
  while (i < raw.length) {
    const c = raw[i];
    if (/\s/.test(c)) {
      space = true;
      i++;
      continue;
    }
    const e = skipAtom(raw, i);
    if (e >= 0) {
      const tok = raw.slice(i, e);
      i = e;
      if (tok.startsWith('/*')) {
        if (comments && !min) {
          space = true;
          flushSpace('/');
          out += tok;
          space = true;
        } else space = true;
        continue;
      }
      flushSpace(tok[0]);
      out += tok;
      continue;
    }
    if (c === '[') attr++;
    else if (c === ']' && attr) attr--;
    const comb = kind === 'selector' && !attr && '>~+'.includes(c);
    if (min && tight.includes(c) && out.at(-1) === ' ') out = out.slice(0, -1);
    flushSpace(c);
    out += c;
    if (!min && kind === 'value' && c === ',' && !/\s/.test(raw[i + 1] ?? ' ')) space = true; // "a,b" -> "a, b"
    if (!min && comb && out.length > 1 && !/[\s(]/.test(out.at(-2) ?? '')) {
      out = out.slice(0, -1) + ' ' + c;
      space = true;
    } else if (!min && comb) space = true;
    i++;
  }
  return out.trim();
}

const unprefixed = (p) => p.toLowerCase().replace(/^-(webkit|moz|ms|o)-/, '');
/** Sort runs of declarations (never across comments or nested rules); custom properties stay first in source order. Returns warnings. */
function sortDecls(nodes, warnings) {
  const out = [];
  let run = [];
  const end = () => {
    const custom = run.filter((d) => d.custom),
      rest = run.filter((d) => !d.custom);
    for (let a = 0; a < rest.length; a++)
      for (let b = a + 1; b < rest.length; b++) {
        const pa = unprefixed(rest[a].prop),
          pb = unprefixed(rest[b].prop);
        if (pa.startsWith(pb + '-')) warnings.add(`"${rest[a].prop}" comes before its shorthand "${rest[b].prop}"; sorting changes which one wins`);
      }
    rest.sort((x, y) => {
      const a = unprefixed(x.prop),
        b = unprefixed(y.prop);
      return a < b ? -1 : a > b ? 1 : (x.prop.startsWith('-') ? 0 : 1) - (y.prop.startsWith('-') ? 0 : 1);
    });
    out.push(...custom, ...rest);
    run = [];
  };
  for (const n of nodes) {
    if (n.type === 'decl') run.push(n);
    else {
      end();
      out.push(n);
    }
  }
  end();
  return out;
}

/**
 * opts: { indent: '  ', comments: true (keep), sort: false, lastSemicolon: true (minify only) }
 * Returns { css, warnings }.
 */
export function beautify(src, opts = {}) {
  const { indent = '  ', comments = true, sort = false } = opts,
    warnings = new Set();
  const lines = [];
  const decl = (d) => `${d.custom ? d.prop : d.prop.toLowerCase()}: ${d.custom ? d.value : clean(d.value, { comments })}${d.important ? ' !important' : ''};`;
  const walk = (nodes, depth) => {
    const pad = indent.repeat(depth);
    if (sort) nodes = sortDecls(nodes, warnings);
    let prev = null; // previous emitted node
    const gap = (isBlock) => {
      if (prev && prev.type !== 'comment' && (isBlock || prev.children) && (depth === 0 || isBlock || prev.children)) lines.push('');
    };
    for (const n of nodes) {
      if (n.type === 'comment') {
        if (!comments) continue;
        gap(depth === 0);
        lines.push(...n.text.split('\n').map((l, k) => (k ? l : pad + l)));
        prev = n;
        continue;
      }
      if (n.type === 'decl') {
        if (prev?.children) lines.push('');
        lines.push(pad + decl(n));
        prev = n;
        continue;
      }
      const head =
        n.type === 'rule'
          ? clean(n.selector, { comments, kind: 'selector' })
              .split(/,(?![^(]*\))/)
              .map((s) => s.trim())
              .join(`,\n${pad}`)
          : `${n.name.toLowerCase()}${n.prelude.trim() ? ' ' + clean(n.prelude, { comments }) : ''}`;
      gap(!!n.children);
      prev = n;
      if (!n.children) {
        lines.push(`${pad}${head};`);
        continue;
      }
      if (!n.children.length) {
        lines.push(`${pad}${head} {}`);
        continue;
      }
      lines.push(`${pad}${head} {`);
      walk(n.children, depth + 1);
      lines.push(`${pad}}`);
    }
  };
  walk(parse(src), 0);
  return {
    css:
      lines
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim() + '\n',
    warnings: [...warnings],
  };
}

export function minify(src, opts = {}) {
  const { comments = false, sort = false, lastSemicolon = false } = opts,
    warnings = new Set();
  const walk = (nodes, top = false) => {
    if (sort) nodes = sortDecls(nodes, warnings);
    let out = '';
    for (const n of nodes) {
      if (n.type === 'comment') {
        if (comments || n.text.startsWith('/*!')) out += n.text;
        continue;
      } // /*! licence */ is always kept
      if (n.type === 'decl') {
        out += `${n.custom ? n.prop : n.prop.toLowerCase()}:${n.custom ? n.value : clean(n.value, { min: true })}${n.important ? '!important' : ''};`;
        continue;
      }
      const head =
        n.type === 'rule'
          ? clean(n.selector, { min: true, kind: 'selector' })
          : `${n.name.toLowerCase()}${n.prelude.trim() ? ' ' + clean(n.prelude, { min: true }) : ''}`;
      if (n.type === 'at' && !n.children) {
        out += `${head};`;
        continue;
      }
      out += `${head}{${walk(n.children)}}`;
    }
    return lastSemicolon || top ? out : out.replace(/;$/, ''); // a top-level ; is kept so files still concatenate
  };
  return { css: walk(parse(src), true), warnings: [...warnings] };
}

/** Rule / declaration counts for the status line. */
export function stats(src) {
  let rules = 0,
    decls = 0,
    at = 0;
  const walk = (ns) =>
    ns.forEach((n) => {
      if (n.type === 'decl') decls++;
      else if (n.type === 'rule') {
        rules++;
        walk(n.children);
      } else if (n.type === 'at') {
        at++;
        if (n.children) walk(n.children);
      }
    });
  walk(parse(src));
  return { rules, decls, at };
}

/** gzip size in bytes (CompressionStream, available in browsers and Node 18+). */
export async function gzipSize(text) {
  const s = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return (await new Response(s).arrayBuffer()).byteLength;
}
