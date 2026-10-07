// XML parser, formatter, minifier and XML <-> JSON converters. Pure functions, no DOM.
// Names are kept exactly as written (prefix:local), so namespaces and their xmlns attributes round-trip untouched.

export class XmlError extends Error {
  constructor(msg, at, src) {
    const before = src.slice(0, at),
      line = before.split('\n').length,
      col = at - before.lastIndexOf('\n');
    super(`${msg} (line ${line}, column ${col})`);
    Object.assign(this, { at, line, col });
  }
}

const NAME = /[A-Za-z_:À-˿Ͱ-῿‌-↏Ⰰ-�][\w.\-:·À-�]*/y;
const ENT = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const cp = (n, m) => (n <= 0x10ffff ? String.fromCodePoint(n) : m); // out-of-range references stay as written (the validator reports them)
export const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === '#' ? cp(parseInt(e[1] === 'x' || e[1] === 'X' ? e.slice(2) : e.slice(1), e[1] === 'x' || e[1] === 'X' ? 16 : 10), m) : (ENT[e] ?? m),
  );
export const escText = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const escAttr = (s) => escText(s).replace(/"/g, '&quot;');

/**
 * Parse XML into { children: Node[] }. Node:
 *   { type: 'element', name, attrs: [{ name, raw, value }], children } | { type: 'text', raw, value } | { type: 'cdata', value }
 *   | { type: 'comment', value } | { type: 'pi', value } | { type: 'doctype', value }
 * Throws XmlError with line/column for anything not well-formed.
 */
export function parse(src) {
  let i = 0;
  const n = src.length,
    doc = { children: [] },
    stack = [doc];
  const err = (m, at = i) => {
    throw new XmlError(m, at, src);
  };
  const until = (end, what) => {
    const e = src.indexOf(end, i);
    if (e < 0) err(`Unterminated ${what}`);
    const v = src.slice(i, e);
    i = e + end.length;
    return v;
  };
  const name = () => {
    NAME.lastIndex = i;
    const m = NAME.exec(src);
    if (!m) err('Expected a name');
    i += m[0].length;
    return m[0];
  };
  const ws = () => {
    while (i < n && ' \t\r\n'.includes(src[i])) i++;
  };
  let rootSeen = false;
  if (src.charCodeAt(0) === 0xfeff) i = 1;
  while (i < n) {
    const parent = stack[stack.length - 1];
    if (src[i] !== '<') {
      const e = src.indexOf('<', i),
        end = e < 0 ? n : e,
        raw = src.slice(i, end);
      if (stack.length === 1 && raw.trim()) err('Text outside the root element');
      const amp = raw.search(/&(?!(#x[0-9a-f]+|#\d+|[\w.-]+);)/i);
      if (amp >= 0) err('Unescaped "&" (write &amp;)', i + amp);
      if (stack.length > 1) parent.children.push({ type: 'text', raw, value: decode(raw) });
      i = end;
      continue;
    }
    const start = i;
    if (src.startsWith('<!--', i)) {
      i += 4;
      const v = until('-->', 'comment');
      if (v.includes('--')) err('"--" is not allowed inside a comment', start);
      parent.children.push({ type: 'comment', value: v });
      continue;
    }
    if (src.startsWith('<![CDATA[', i)) {
      if (stack.length === 1) err('CDATA outside the root element');
      i += 9;
      parent.children.push({ type: 'cdata', value: until(']]>', 'CDATA section') });
      continue;
    }
    if (src.startsWith('<?', i)) {
      i += 2;
      const v = until('?>', 'processing instruction');
      if (/^xml\b/i.test(v) && start > (src.charCodeAt(0) === 0xfeff ? 1 : 0)) err('The XML declaration must be at the very start', start);
      parent.children.push({ type: 'pi', value: v });
      continue;
    }
    if (src.startsWith('<!DOCTYPE', i)) {
      let depth = 0,
        j = i + 9;
      for (; j < n; j++) {
        if (src[j] === '[') depth++;
        else if (src[j] === ']') depth--;
        else if (src[j] === '>' && depth <= 0) break;
      }
      if (j >= n) err('Unterminated DOCTYPE');
      parent.children.push({ type: 'doctype', value: src.slice(i + 2, j) });
      i = j + 1;
      continue;
    }
    if (src[i + 1] === '/') {
      i += 2;
      const nm = name();
      ws();
      if (src[i] !== '>') err(`Expected ">" to close </${nm}`);
      i++;
      if (stack.length === 1) err(`Closing tag </${nm}> has no matching opening tag`, start);
      if (parent.name !== nm) err(`Closing tag </${nm}> does not match <${parent.name}>`, start);
      stack.pop();
      continue;
    }
    i++;
    if (stack.length === 1 && rootSeen) err('Only one root element is allowed', start);
    const el = { type: 'element', name: name(), attrs: [], children: [], at: start };
    for (;;) {
      const had = i;
      ws();
      if (src[i] === '>' || src.startsWith('/>', i)) break;
      if (i >= n) err(`Unterminated tag <${el.name}>`, start);
      if (had === i) err(`Expected whitespace or ">" in <${el.name}>`);
      const an = name();
      ws();
      if (src[i] !== '=') err(`Attribute "${an}" needs a value`);
      i++;
      ws();
      const q = src[i];
      if (q !== '"' && q !== "'") err(`Attribute "${an}" value must be quoted`);
      i++;
      const raw = until(q, 'attribute value');
      if (raw.includes('<')) err(`"<" is not allowed in attribute "${an}"`);
      if (el.attrs.some((a) => a.name === an)) err(`Duplicate attribute "${an}"`);
      el.attrs.push({ name: an, raw, value: decode(raw) });
    }
    parent.children.push(el);
    if (stack.length === 1) rootSeen = true;
    if (src[i] === '/') i += 2;
    else {
      i++;
      stack.push(el);
    }
  }
  if (stack.length > 1) {
    const open = stack[stack.length - 1];
    err(`<${open.name}> is never closed`, open.at);
  }
  if (!rootSeen) err('No root element found');
  return doc;
}

const preserves = (el, inherited) => {
  const a = el.attrs.find((x) => x.name === 'xml:space');
  return a ? a.value === 'preserve' : inherited;
};
const attrsOut = (el) => el.attrs.map((a) => ` ${a.name}="${a.raw.replace(/"/g, '&quot;')}"`).join('');
const inlineOut = (node) => {
  // exact serialisation, no whitespace changes
  switch (node.type) {
    case 'text':
      return node.raw;
    case 'cdata':
      return `<![CDATA[${node.value}]]>`;
    case 'comment':
      return `<!--${node.value}-->`;
    case 'pi':
      return `<?${node.value}?>`;
    case 'doctype':
      return `<!${node.value}>`;
    default:
      return node.children.length
        ? `<${node.name}${attrsOut(node)}>${node.children.map(inlineOut).join('')}</${node.name}>`
        : `<${node.name}${attrsOut(node)}/>`;
  }
};

/**
 * Pretty-print. opts: { indent: string, comments: bool }.
 * Mixed content (text next to elements) and xml:space="preserve" are kept exactly as written.
 */
export function format(src, opts = {}) {
  const { indent = '  ', comments = true } = opts;
  const lines = [];
  const walk = (node, d, keep) => {
    const pad = indent.repeat(d);
    if (node.type === 'comment') {
      if (comments) lines.push(pad + inlineOut(node));
      return;
    }
    if (node.type === 'text') {
      const t = node.raw.trim();
      if (t) lines.push(pad + t);
      return;
    }
    if (node.type !== 'element') {
      lines.push(pad + inlineOut(node));
      return;
    }
    const kids = node.children.filter((c) => comments || c.type !== 'comment');
    const p = preserves(node, keep);
    const textual = kids.every((c) => c.type === 'text' || c.type === 'cdata');
    const mixed = kids.some((c) => c.type === 'text' && c.raw.trim()) && kids.some((c) => c.type === 'element');
    if (!kids.length || (textual && kids.every((c) => c.type === 'text' && !c.raw.trim()) && !p)) {
      lines.push(`${pad}<${node.name}${attrsOut(node)}/>`);
      return;
    }
    if (p || mixed || textual) {
      // kept on one line; plain text is trimmed, anything else exact
      const inner = kids.map(inlineOut).join('');
      lines.push(`${pad}<${node.name}${attrsOut(node)}>${!p && !mixed && kids.every((c) => c.type === 'text') ? inner.trim() : inner}</${node.name}>`);
      return;
    }
    lines.push(`${pad}<${node.name}${attrsOut(node)}>`);
    for (const c of kids) walk(c, d + 1, p);
    lines.push(`${pad}</${node.name}>`);
  };
  for (const c of parse(src).children) walk(c, 0, false);
  return lines.join('\n');
}

/** Minify: drop whitespace-only text between tags (not inside xml:space="preserve") and, optionally, comments. */
export function minify(src, opts = {}) {
  const { comments = false } = opts;
  const out = (node, keep) => {
    if (node.type === 'comment') return comments ? inlineOut(node) : '';
    if (node.type === 'text') return keep || node.raw.trim() ? node.raw : '';
    if (node.type !== 'element') return inlineOut(node);
    const p = preserves(node, keep);
    const inner = node.children.map((c) => out(c, p)).join('');
    return inner ? `<${node.name}${attrsOut(node)}>${inner}</${node.name}>` : `<${node.name}${attrsOut(node)}/>`;
  };
  return parse(src)
    .children.map((c) => out(c, false))
    .join('');
}

/**
 * XML -> JSON value. Attributes become "@name", text "#text", repeated elements arrays.
 * opts: { cdata: 'text' | 'key' (as "#cdata"), comments: bool (as "#comment"), trim: bool }
 */
export function toJson(src, opts = {}) {
  const { cdata = 'text', comments = false, trim = true } = opts;
  const conv = (el) => {
    const o = {};
    const add = (k, v) => {
      if (!(k in o)) o[k] = v;
      else if (Array.isArray(o[k])) o[k].push(v);
      else o[k] = [o[k], v];
    }; // conv never returns an array
    for (const a of el.attrs) o['@' + a.name] = a.value;
    let text = '',
      cd = '';
    for (const c of el.children) {
      if (c.type === 'element') add(c.name, conv(c));
      else if (c.type === 'text') text += c.value;
      else if (c.type === 'cdata') {
        if (cdata === 'text') text += c.value;
        else cd += c.value;
      } else if (c.type === 'comment' && comments) add('#comment', c.value.trim());
    }
    if (trim) text = text.trim();
    const keys = Object.keys(o);
    if (!keys.length && !cd) return text;
    if (text) o['#text'] = text;
    if (cd) o['#cdata'] = cd;
    return o;
  };
  const root = parse(src).children.find((c) => c.type === 'element');
  return { [root.name]: conv(root) };
}

// Unicode letters are valid in XML names; at most one ":" (prefix:local).
const okName = (k) => /^[\p{L}_][\p{L}\p{N}\p{M}_.-]*(:[\p{L}_][\p{L}\p{N}\p{M}_.-]*)?$/u.test(k);
const fixName = (k) => {
  let s = String(k).replace(/[^\p{L}\p{N}\p{M}_.-]/gu, '_');
  if (!/^[\p{L}_]/u.test(s)) s = '_' + s;
  return s;
};

/**
 * JSON value -> XML string. Inverse of toJson. Returns { xml, warnings }.
 * opts: { indent, root: name used when the JSON has no single top-level key, declaration: bool }
 */
export function fromJson(value, opts = {}) {
  const { indent = '  ', root = 'root', declaration = true } = opts;
  const warnings = new Set(),
    lines = [];
  const nameOf = (k) => {
    if (okName(k)) return k;
    const f = fixName(k);
    warnings.add(`"${k}" is not a valid XML name; written as "${f}"`);
    return f;
  };
  const scalar = (v) => (v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  const cdataOut = (s) => `<![CDATA[${String(s).split(']]>').join(']]]]><![CDATA[>')}]]>`;
  const commentOut = (s) => `<!-- ${String(s).replace(/--/g, '- -').replace(/-$/, '- ')} -->`;
  const el = (name, v, d) => {
    const pad = indent.repeat(d),
      tag = nameOf(name);
    if (Array.isArray(v)) {
      for (const x of v) el(name, x, d);
      return;
    }
    if (v === null || typeof v !== 'object') {
      const s = scalar(v);
      lines.push(s === '' ? `${pad}<${tag}/>` : `${pad}<${tag}>${escText(s)}</${tag}>`);
      return;
    }
    let attrs = '',
      text = '',
      cd = [],
      cm = [];
    const kids = [];
    for (const [k, x] of Object.entries(v)) {
      if (k.startsWith('@')) {
        if (x !== null && typeof x === 'object') warnings.add(`Attribute "${k}" holds an object; written as JSON text`);
        attrs += ` ${nameOf(k.slice(1))}="${escAttr(scalar(x))}"`;
      } else if (k === '#text') text += scalar(x);
      else if (k === '#cdata') cd.push(...[x].flat());
      else if (k === '#comment') cm.push(...[x].flat());
      else kids.push([k, x]);
    }
    const inner = escText(text) + cd.map(cdataOut).join('');
    if (!kids.length && !cm.length) {
      lines.push(inner ? `${pad}<${tag}${attrs}>${inner}</${tag}>` : `${pad}<${tag}${attrs}/>`);
      return;
    }
    lines.push(`${pad}<${tag}${attrs}>`);
    for (const c of cm) lines.push(indent.repeat(d + 1) + commentOut(c));
    if (inner) lines.push(indent.repeat(d + 1) + inner);
    for (const [k, x] of kids) el(k, x, d + 1);
    lines.push(`${pad}</${tag}>`);
  };
  const keys = value && typeof value === 'object' && !Array.isArray(value) ? Object.keys(value) : [];
  if (keys.length === 1 && !keys[0].startsWith('@') && !keys[0].startsWith('#') && !Array.isArray(value[keys[0]])) el(keys[0], value[keys[0]], 0);
  else {
    if (keys.length !== 1 || Array.isArray(value))
      warnings.add(
        `The JSON has ${Array.isArray(value) ? 'an array' : keys.length ? 'several top-level keys' : 'no single top-level key'}; wrapped in <${root}>`,
      );
    el(root, Array.isArray(value) ? { item: value } : value, 0);
  }
  return { xml: (declaration ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '') + lines.join('\n'), warnings: [...warnings] };
}

/** Read line/column and message from a DOMParser <parsererror> text (Chrome/Safari and Firefox wording). */
export function parserErrorInfo(text) {
  const t = String(text)
    .replace(/Below is a rendering of the page.*$/is, '')
    .replace(/\s+/g, ' ')
    .trim();
  let m = /line (\d+) at column (\d+): (.*)$/i.exec(t);
  if (m) return { line: +m[1], col: +m[2], message: m[3].trim() };
  m = /XML Parsing Error: (.*?) Location:.*?Line Number (\d+), Column (\d+)/i.exec(t);
  if (m) return { line: +m[2], col: +m[3], message: m[1].trim() };
  return { line: 0, col: 0, message: t.replace(/^This page contains the following errors: ?/i, '') };
}

/** Offset of line/col in src (1-based), clamped. */
export function offsetOf(src, line, col) {
  let at = 0;
  for (let l = 1; l < line; l++) {
    const e = src.indexOf('\n', at);
    if (e < 0) break;
    at = e + 1;
  }
  return Math.min(src.length, at + Math.max(0, col - 1));
}
