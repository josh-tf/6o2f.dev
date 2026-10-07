// SVG sanitising and optimising on a small tree: { t: 'el', name, attrs: [[k, v]], kids } | { t: 'text', v } | { t: 'comment', v } | { t: 'cdata', v }.
// The browser builds the tree from DOMParser (fromDom); parseXml is a small XML parser for Node tests and as a fallback. Values are decoded text.

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    }
    return ENT[e.toLowerCase()] ?? m;
  });
const escText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escAttr = (s) => escText(s).replace(/"/g, '&quot;');

/** Minimal XML parser. Throws Error with a message on malformed input. Drops <?...?> and <!DOCTYPE> (and any internal entity subset). */
export function parseXml(src) {
  const root = { t: 'el', name: '#root', attrs: [], kids: [] },
    stack = [root];
  let i = 0;
  const top = () => stack[stack.length - 1];
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i + 4);
      if (e < 0) throw new Error('Unclosed comment');
      top().kids.push({ t: 'comment', v: src.slice(i + 4, e) });
      i = e + 3;
    } else if (src.startsWith('<![CDATA[', i)) {
      const e = src.indexOf(']]>', i);
      if (e < 0) throw new Error('Unclosed CDATA section');
      top().kids.push({ t: 'cdata', v: src.slice(i + 9, e) });
      i = e + 3;
    } else if (src.startsWith('<?', i)) {
      const e = src.indexOf('?>', i);
      if (e < 0) throw new Error('Unclosed processing instruction');
      i = e + 2;
    } else if (/^<!doctype/i.test(src.slice(i, i + 9))) {
      // skip, including a [...] internal subset
      let depth = 0,
        j = i + 9;
      for (; j < src.length; j++) {
        const ch = src[j];
        if (ch === '[') depth++;
        else if (ch === ']') depth--;
        else if (ch === '>' && depth <= 0) break;
      }
      i = j + 1;
    } else if (src.startsWith('</', i)) {
      const m = /^<\/([^\s>]+)\s*>/.exec(src.slice(i));
      if (!m) throw new Error('Bad closing tag');
      if (top().name !== m[1]) throw new Error(`Closing </${m[1]}> does not match <${top().name}>`);
      stack.pop();
      i += m[0].length;
    } else if (src[i] === '<') {
      const m = /^<([A-Za-z_][\w.:-]*)/.exec(src.slice(i));
      if (!m) throw new Error(`Unexpected "<" at character ${i}`);
      const el = { t: 'el', name: m[1], attrs: [], kids: [] };
      i += m[0].length;
      for (;;) {
        const ws = /^\s*/.exec(src.slice(i))[0];
        i += ws.length;
        if (src.startsWith('/>', i)) {
          i += 2;
          top().kids.push(el);
          break;
        }
        if (src[i] === '>') {
          i++;
          top().kids.push(el);
          stack.push(el);
          break;
        }
        const a = /^([^\s=/>]+)\s*=\s*("([^"]*)"|'([^']*)')/.exec(src.slice(i));
        if (!a || !ws) throw new Error(`Bad attribute in <${el.name}>`);
        el.attrs.push([a[1], decode(a[3] ?? a[4])]);
        i += a[0].length;
      }
    } else {
      const e = src.indexOf('<', i),
        v = src.slice(i, e < 0 ? undefined : e);
      top().kids.push({ t: 'text', v: decode(v) });
      i = e < 0 ? src.length : e;
    }
  }
  if (stack.length > 1) throw new Error(`<${top().name}> is never closed`);
  const els = root.kids.filter((k) => k.t === 'el');
  if (els.length !== 1) throw new Error(els.length ? 'More than one root element' : 'No SVG element found');
  return els[0];
}
/** Tree from a DOM node (DOMParser output in the browser). */
export function fromDom(n) {
  if (n.nodeType === 3) return { t: 'text', v: n.nodeValue };
  if (n.nodeType === 4) return { t: 'cdata', v: n.nodeValue };
  if (n.nodeType === 8) return { t: 'comment', v: n.nodeValue };
  if (n.nodeType !== 1) return null;
  return { t: 'el', name: n.nodeName, attrs: [...n.attributes].map((a) => [a.name, a.value]), kids: [...n.childNodes].map(fromDom).filter(Boolean) };
}
export function serialize(n) {
  if (n.t === 'text') return escText(n.v);
  if (n.t === 'cdata') return n.v.includes(']]>') ? escText(n.v) : `<![CDATA[${n.v}]]>`;
  if (n.t === 'comment') return `<!--${n.v.replace(/--/g, '- -')}-->`;
  const a = n.attrs.map(([k, v]) => ` ${k}="${escAttr(v)}"`).join('');
  return n.kids.length ? `<${n.name}${a}>${n.kids.map(serialize).join('')}</${n.name}>` : `<${n.name}${a}/>`;
}
const local = (name) => name.slice(name.indexOf(':') + 1).toLowerCase();
const walk = (n, f) => {
  if (n.t === 'el') {
    n.kids = n.kids.filter((k) => f(k, n) !== false);
    n.kids.forEach((k) => walk(k, f));
  }
};

const BAD_EL = new Set(['script', 'foreignobject', 'iframe', 'embed', 'object', 'audio', 'video', 'handler', 'listener', 'discard']);
const LINK_ATTR = /^(href|xlink:href|src|action|formaction|data)$/i;
const BAD_URL = /^\s*(javascript|vbscript|data)\s*:/i;
/** Sanitise in place. Returns a list of what was removed: { what, count }. */
export function sanitize(root) {
  const log = new Map(),
    note = (what) => log.set(what, (log.get(what) ?? 0) + 1);
  if (local(root.name) !== 'svg') throw new Error(`The root element is <${root.name}>, not <svg>`);
  const clean = (n) => {
    if (n.t !== 'el') return true;
    const ln = local(n.name);
    if (BAD_EL.has(ln)) {
      note(`<${ln === 'foreignobject' ? 'foreignObject' : ln}> element`);
      return false;
    }
    if (/^(set|animate|animatetransform|animatemotion)$/.test(ln)) {
      // SMIL can rewrite href or handlers after load
      const target = local((n.attrs.find(([k]) => k === 'attributeName')?.[1] ?? '').trim());
      if (/^(on|href$)/.test(target) || n.attrs.some(([, v]) => /javascript:/i.test(v.replace(/\s+/g, '')))) {
        note(`<${ln}> changing a link or handler`);
        return false;
      }
    }
    n.attrs = n.attrs.flatMap(([k, v]) => {
      const lk = local(k),
        compact = v.replace(/[\s\u0000-\u001f]+/g, '');
      if (lk.startsWith('on')) {
        note('on* event attribute');
        return [];
      }
      if (LINK_ATTR.test(lk) && !/^#/.test(v.trim())) {
        note(BAD_URL.test(compact) ? `${/^data/i.test(compact) ? 'data:' : 'javascript:'} link` : 'external link or reference');
        return [];
      }
      if (/(javascript|vbscript):/i.test(compact)) {
        note('javascript: value');
        return [];
      }
      if (lk === 'style' || /url\(|@import|expression/i.test(v)) v = cleanCss(v, note);
      return v.trim() || lk !== 'style' ? [[k, v]] : [];
    });
    if (ln === 'style')
      n.kids = n.kids.map((k) => (k.t === 'text' || k.t === 'cdata' ? { t: 'text', v: cleanCss(k.v, note) } : k)).filter((k) => k.t === 'text');
    return true;
  };
  clean(root);
  walk(root, clean);
  return [...log].map(([what, count]) => ({ what, count }));
}
/** Remove @import and any url() that is not a local #fragment from CSS text. */
export function cleanCss(css, note) {
  return css
    .replace(/@import[^;]*;?/gi, () => (note('CSS @import'), ''))
    .replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (m, q, u) => (u.startsWith('#') ? m : (note('external CSS url()'), 'none')))
    .replace(/expression\s*\(/gi, () => (note('CSS expression()'), '('));
}

const EDITOR_NS = /^(inkscape|sodipodi|sketch|i|x|graph|a|serif|figma|krita|dc|cc|rdf|ns\d+|adobe-?\w*|illustrator)$/i;
const EDITOR_URI = /inkscape|sodipodi|bohemiancoding|adobe|ns\.adobe|serif\.com|figma|krita|purl\.org\/dc|creativecommons|rdf-syntax/i;
const DEFAULTS = {
  'fill-opacity': '1',
  'stroke-opacity': '1',
  opacity: '1',
  'stroke-width': '1',
  'stroke-linecap': 'butt',
  'stroke-linejoin': 'miter',
  'stroke-miterlimit': '4',
  'stroke-dasharray': 'none',
  'stroke-dashoffset': '0',
  'fill-rule': 'nonzero',
  'clip-rule': 'nonzero',
  visibility: 'visible',
  display: 'inline',
  'font-style': 'normal',
  'font-weight': 'normal',
  'text-anchor': 'start',
  stroke: 'none',
  baseProfile: 'full',
  'xml:space': 'default',
  version: '1.1',
  'enable-background': 'new',
};
const ZERO = {
  x: ['rect', 'image', 'use', 'svg', 'foreignobject'],
  y: ['rect', 'image', 'use', 'svg', 'foreignobject'],
  cx: ['circle', 'ellipse'],
  cy: ['circle', 'ellipse'],
  x1: ['line'],
  y1: ['line'],
  x2: ['line'],
  y2: ['line'],
};
const NUMERIC =
  /^(d|points|viewBox|transform|gradientTransform|patternTransform|x|y|x1|y1|x2|y2|cx|cy|r|rx|ry|fx|fy|width|height|stroke-width|stroke-dasharray|stroke-dashoffset|offset|opacity|fill-opacity|stroke-opacity|font-size|dx|dy|rotate)$/;
export const roundNum = (s, dp) =>
  s.replace(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi, (m) => {
    if (/^-?0\d/.test(m)) return m; // packed arc flags like "01" or "0010.5": leave alone rather than misread them as one number
    const v = +(+m).toFixed(dp);
    return String(Object.is(v, -0) ? 0 : v).replace(/^(-?)0\./, '$1.');
  });
const ws = (s) => s.replace(/\s+/g, ' ').trim();

const NOT_INHERITED = new Set(['opacity', 'display', 'version', 'baseProfile', 'enable-background']);
/** Optimise in place. opts: { comments, metadata, editor, defaults, round (decimals or -1 = off), whitespace }. */
export function optimize(root, o) {
  const textLike = new Set(['text', 'tspan', 'textpath', 'title', 'desc', 'style']);
  const xlink = usesXlink(root);
  const keep = (n, parent, inh) => {
    if (n.t === 'comment') return !o.comments;
    if (n.t === 'text' || n.t === 'cdata') {
      if (!o.whitespace) return true;
      if (parent && textLike.has(local(parent.name))) {
        n.v = n.v.replace(/\s+/g, ' ');
        if (local(parent.name) === 'style') n.v = n.v.trim();
        return n.v !== '';
      }
      return n.v.trim() !== '';
    }
    const ln = local(n.name),
      pre = n.name.includes(':') ? n.name.split(':')[0] : '';
    if (o.metadata && ln === 'metadata') return false;
    if (o.editor && pre && EDITOR_NS.test(pre)) return false;
    n.attrs = n.attrs
      .filter(([k, v]) => {
        const p = k.includes(':') ? k.split(':')[0] : '';
        if (o.editor) {
          if (k.startsWith('xmlns:') && (EDITOR_URI.test(v) || EDITOR_NS.test(k.slice(6)))) return false;
          if (p && !['xmlns', 'xlink', 'xml'].includes(p) && EDITOR_NS.test(p)) return false;
          if (/^data-(name|figma|sketch)/.test(k)) return false;
        }
        if (o.defaults) {
          // an inherited property at its default is only redundant when no ancestor sets it (otherwise it is an override)
          if (DEFAULTS[k] !== undefined && ws(v) === DEFAULTS[k] && (NOT_INHERITED.has(k) || !inh.has(k))) return false;
          if (ZERO[k]?.includes(ln) && /^0(\.0*)?(px)?$/.test(v.trim())) return false;
          if (k === 'xmlns:xlink' && !xlink) return false;
        }
        return true;
      })
      .map(([k, v]) => {
        if (o.round >= 0 && NUMERIC.test(k)) v = roundNum(v, o.round);
        if (o.whitespace) v = ws(v);
        if (o.whitespace && k === 'd')
          v = v
            .replace(/\s*([a-df-zA-DF-Z])\s*/g, '$1')
            .replace(/\s*,\s*/g, ',')
            .replace(/ (-)/g, '$1');
        return [k, v];
      });
    const next = new Set(inh);
    for (const [k] of n.attrs) if (DEFAULTS[k] !== undefined) next.add(k);
    n.kids = n.kids.filter((c) => keep(c, n, next));
    return true;
  };
  keep(root, null, new Set());
  return root;
}
const usesXlink = (n) => n.t === 'el' && (n.attrs.some(([k]) => k.startsWith('xlink:')) || n.kids.some(usesXlink));

export const attr = (n, k) => n.attrs.find(([a]) => a === k)?.[1];
export function setAttr(n, k, v) {
  const i = n.attrs.findIndex(([a]) => a === k);
  if (v === '' || v == null) {
    if (i >= 0) n.attrs.splice(i, 1);
  } else if (i >= 0) n.attrs[i][1] = String(v);
  else n.attrs.push([k, String(v)]);
}

/** Data URI with minimal escaping (smaller than base64, safe in url("...")). Double quotes become single ones, unless the
 *  markup already uses ' (e.g. font-family="'Open Sans'"): percent-escapes are decoded before the XML is parsed, so then " is encoded instead. */
export const dataUri = (svg) => {
  const s = svg.replace(/[\r\n%#()<>?[\\\]^`{|}]/g, encodeURIComponent);
  return 'data:image/svg+xml,' + (s.includes("'") ? s.replace(/"/g, '%22') : s.replace(/"/g, "'"));
};
export function base64Uri(svg) {
  const b = new TextEncoder().encode(svg);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return 'data:image/svg+xml;base64,' + btoa(s);
}
export const cssBg = (svg) => `background-image: url("${dataUri(svg)}");`;
/** Full pipeline on a tree: sanitise, optimise, serialise. */
export function process(tree, opts, dims = null) {
  const removed = sanitize(tree);
  optimize(tree, opts);
  if (dims) for (const k of ['viewBox', 'width', 'height']) if (dims[k] !== undefined) setAttr(tree, k, dims[k].trim());
  if (!attr(tree, 'xmlns')) tree.attrs.unshift(['xmlns', 'http://www.w3.org/2000/svg']);
  return { svg: serialize(tree), removed };
}
