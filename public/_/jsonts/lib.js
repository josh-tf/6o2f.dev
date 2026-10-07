// JSON sample -> TypeScript / JSON Schema 2020-12 / Python / Go types. Pure functions, no DOM.
// Every value seen at the same place is merged into one shape: keys missing from some objects become optional,
// differing primitive types become unions, objects with the same structure share one named type.

const DT = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/i,
  D = /^\d{4}-\d{2}-\d{2}$/;
const blank = () => ({ prims: new Set(), fmt: undefined, obj: null, arr: null });

function add(t, v) {
  if (v === null) t.prims.add('null');
  else if (typeof v === 'boolean') t.prims.add('boolean');
  else if (typeof v === 'number') t.prims.add(Number.isInteger(v) ? 'integer' : 'number');
  else if (typeof v === 'string') {
    t.prims.add('string');
    const f = DT.test(v) ? 'date-time' : D.test(v) ? 'date' : false;
    t.fmt = t.fmt === undefined || t.fmt === f ? f : false;
  } else if (Array.isArray(v)) {
    t.arr ??= blank();
    for (const x of v) add(t.arr, x);
  } else {
    t.obj ??= { keys: new Map(), seen: new Map(), n: 0 };
    t.obj.n++;
    for (const [k, x] of Object.entries(v)) {
      if (!t.obj.keys.has(k)) t.obj.keys.set(k, blank());
      add(t.obj.keys.get(k), x);
      t.obj.seen.set(k, (t.obj.seen.get(k) ?? 0) + 1);
    }
  }
  return t;
}
const prims = (t) => {
  const p = new Set(t.prims);
  if (p.has('number')) p.delete('integer');
  return [...p];
};
const isEmpty = (t) => !t.prims.size && !t.obj && !t.arr;

// ---------- naming ----------
const IRREGULAR = {
  people: 'person',
  children: 'child',
  men: 'man',
  women: 'woman',
  mice: 'mouse',
  geese: 'goose',
  feet: 'foot',
  teeth: 'tooth',
  criteria: 'criterion',
  indices: 'index',
  matrices: 'matrix',
  vertices: 'vertex',
  analyses: 'analysis',
  statuses: 'status',
  aliases: 'alias',
  buses: 'bus',
  news: 'news',
  series: 'series',
  species: 'species',
  movies: 'movie',
  cookies: 'cookie',
  pies: 'pie',
  ties: 'tie',
  zombies: 'zombie',
  calories: 'calorie',
  caches: 'cache',
  niches: 'niche',
  heroes: 'hero',
  potatoes: 'potato',
  tomatoes: 'tomato',
  echoes: 'echo',
  quizzes: 'quiz',
  axes: 'axis',
  leaves: 'leaf',
  lives: 'life',
  wives: 'wife',
  knives: 'knife',
  halves: 'half',
  shelves: 'shelf',
  wolves: 'wolf',
  thieves: 'thief',
};
export function singular(w) {
  const lower = w.toLowerCase();
  if (IRREGULAR[lower]) return w.slice(0, 1) + IRREGULAR[lower].slice(1);
  if (/[^aeiou]ies$/i.test(w)) return w.slice(0, -3) + 'y';
  if (/(ss|x|zz|ch|sh)es$/i.test(w)) return w.slice(0, -2);
  if (/[^su]s$/i.test(w) && !/(ss|us|is)$/i.test(w)) return w.slice(0, -1);
  return w;
}
export function pascal(s) {
  const words = String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  let r = words.map((x) => x[0].toUpperCase() + x.slice(1)).join('');
  if (!r) r = 'Type';
  if (/^\d/.test(r)) r = 'T' + r;
  return r;
}
const sig = (t) =>
  JSON.stringify([
    prims(t).sort(),
    t.fmt || '',
    t.arr ? sig(t.arr) : '',
    t.obj ? [...t.obj.keys].map(([k, v]) => [k, t.obj.seen.get(k) === t.obj.n, sig(v)]) : '',
  ]);

/** Assign names to every object shape; returns ordered list of { name, obj } (root first). */
function nameAll(root, rootName) {
  const out = [],
    bySig = new Map(),
    used = new Set();
  const visit = (t, hint, parent, inArray) => {
    if (t.arr) visit(t.arr, hint, parent, true);
    if (!t.obj) return;
    const s = sig({ ...t, prims: new Set(), arr: null, fmt: undefined });
    if (bySig.has(s)) {
      t.obj.name = bySig.get(s);
      return;
    }
    let base = pascal(inArray ? singular(hint) : hint);
    if (inArray && base === pascal(hint) && hint !== rootName) base += 'Item';
    let name = base;
    if (used.has(name) && parent) name = parent + base;
    for (let i = 2; used.has(name); i++) name = base + i;
    used.add(name);
    bySig.set(s, name);
    t.obj.name = name;
    out.push({ name, obj: t.obj });
    for (const [k, v] of t.obj.keys) visit(v, k, name, false);
  };
  visit(root, rootName, '', false);
  return out;
}

export function infer(value) {
  return add(blank(), value);
}

// ---------- emitters ----------
const IDENT = /^[A-Za-z_$][\w$]*$/;
const GO_INIT = new Set([
  'ID',
  'URL',
  'URI',
  'API',
  'HTTP',
  'HTTPS',
  'JSON',
  'XML',
  'HTML',
  'SQL',
  'UUID',
  'IP',
  'CPU',
  'TTL',
  'UI',
  'UID',
  'DNS',
  'SSH',
  'TLS',
  'EOF',
  'ACL',
  'ASCII',
  'RAM',
  'UTF8',
  'VM',
  'XSS',
  'CSS',
  'IO',
]);

function ts(root, names, o) {
  const ro = o.readonly ? 'readonly ' : '';
  const expr = (t) => {
    const parts = [];
    for (const p of prims(t)) parts.push(p === 'integer' ? 'number' : p);
    if (t.obj) parts.push(t.obj.name);
    if (t.arr) {
      const e = expr(t.arr);
      parts.push(`${ro}${/[ |]/.test(e) && !e.startsWith('readonly') ? `(${e})` : /\s/.test(e) ? `(${e})` : e}[]`);
    }
    return parts.length ? parts.join(' | ') : 'unknown';
  };
  const blocks = names.map(({ name, obj }) => {
    const lines = [...obj.keys].map(([k, v]) => {
      const opt = obj.seen.get(k) < obj.n ? '?' : '';
      const note = o.dates && v.fmt && prims(v).includes('string') ? ` // ${v.fmt}` : '';
      return `  ${ro}${IDENT.test(k) ? k : JSON.stringify(k)}${opt}: ${expr(v)};${note}`;
    });
    if (o.style === 'type') return `export type ${name} = {\n${lines.join('\n')}${lines.length ? '\n' : ''}};`;
    return `export interface ${name} {\n${lines.join('\n')}${lines.length ? '\n' : ''}}`;
  });
  if (!root.obj || root.prims.size || root.arr) blocks.unshift(`export type ${o.aliasName} = ${expr(root)};`);
  return blocks.join('\n\n') + '\n';
}

function schema(root, names, o) {
  const node = (t) => {
    const types = prims(t),
      alts = [];
    if (types.length) {
      const s = { type: types.length === 1 ? types[0] : types };
      if (o.dates && t.fmt && types.includes('string')) s.format = t.fmt;
      alts.push(s);
    }
    if (t.obj) alts.push({ $ref: `#/$defs/${t.obj.name}` });
    if (t.arr) alts.push({ type: 'array', items: isEmpty(t.arr) ? {} : node(t.arr) });
    if (!alts.length) return {};
    return alts.length === 1 ? alts[0] : { anyOf: alts };
  };
  const def = (obj) => {
    const props = {},
      req = [];
    for (const [k, v] of obj.keys) {
      props[k] = node(v);
      if (obj.seen.get(k) === obj.n) req.push(k);
    }
    return { type: 'object', properties: props, ...(req.length ? { required: req } : {}) };
  };
  const top = node(root);
  const out = { $schema: 'https://json-schema.org/draft/2020-12/schema', title: o.rootName };
  if (top.$ref && names[0]?.obj === root.obj) Object.assign(out, def(root.obj));
  else Object.assign(out, top);
  const defs = Object.fromEntries(names.filter((n) => !(top.$ref && n.obj === root.obj)).map((n) => [n.name, def(n.obj)]));
  if (Object.keys(defs).length) out.$defs = defs;
  const s = JSON.stringify(out, null, 2);
  return (top.$ref ? s.replaceAll(JSON.stringify(top.$ref), '"#"') : s) + '\n'; // the root object is inlined, so references to it point at "#"
}

const pyIdent = (k) => /^[A-Za-z_]\w*$/.test(k) && !PY_KW.has(k);
const PY_KW = new Set(
  'False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield'.split(
    ' ',
  ),
);
const snake = (k) => {
  let s =
    String(k)
      .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
      .replace(/[^A-Za-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase() || 'field';
  if (/^\d/.test(s)) s = 'f_' + s;
  return PY_KW.has(s) ? s + '_' : s;
};

function python(root, names, o) {
  const imports = new Set();
  const expr = (t) => {
    const parts = [];
    for (const p of prims(t)) parts.push({ string: 'str', integer: 'int', number: 'float', boolean: 'bool', null: 'None' }[p]);
    if (t.obj) parts.push(t.obj.name);
    if (t.arr) parts.push(`list[${expr(t.arr)}]`);
    if (!parts.length) {
      imports.add('Any');
      return 'Any';
    }
    // keep None last: "str | None"
    return parts.sort((a, b) => (a === 'None') - (b === 'None')).join(' | ');
  };
  const blocks = [...names].reverse().map(({ name, obj }) => {
    const entries = [...obj.keys].map(([k, v]) => ({
      k,
      v,
      opt: obj.seen.get(k) < obj.n,
      note: o.dates && v.fmt && prims(v).includes('string') ? `  # ${v.fmt}` : '',
    }));
    if (o.py === 'dataclass') {
      const fields = [...entries.filter((e) => !e.opt), ...entries.filter((e) => e.opt)].map(({ k, v, opt, note }) => {
        let ty = expr(v);
        if (opt && !/\bNone\b/.test(ty)) ty += ' | None';
        const id = snake(k),
          json = id !== k ? `  # JSON key: ${JSON.stringify(k)}` : '';
        return `    ${id}: ${ty}${opt ? ' = None' : ''}${note || json ? (note ? note + (json ? `; ${json.trim().slice(2)}` : '') : json) : ''}`;
      });
      return `@dataclass${o.readonly ? '(frozen=True)' : ''}\nclass ${name}:\n${fields.join('\n') || '    pass'}`;
    }
    const ann = (e) => {
      let ty = expr(e.v);
      if (o.readonly) {
        imports.add('ReadOnly');
        ty = `ReadOnly[${ty}]`;
      }
      if (e.opt) {
        imports.add('NotRequired');
        ty = `NotRequired[${ty}]`;
      }
      return ty;
    };
    if (entries.every((e) => pyIdent(e.k)))
      return `class ${name}(TypedDict):\n${entries.map((e) => `    ${e.k}: ${ann(e)}${e.note}`).join('\n') || '    pass'}`;
    return `${name} = TypedDict(${JSON.stringify(name)}, {\n${entries.map((e) => `    ${JSON.stringify(e.k)}: ${ann(e)},${e.note}`).join('\n')}\n})`;
  });
  if (!root.obj || root.prims.size || root.arr) blocks.push(`${o.aliasName} = ${expr(root)}`);
  const head = ['from __future__ import annotations', ''];
  if (o.py === 'dataclass') head.push('from dataclasses import dataclass');
  const typing = [...imports, ...(o.py === 'dataclass' ? [] : ['TypedDict'])].sort();
  if (typing.length) head.push(`from typing import ${typing.join(', ')}`);
  return head.join('\n') + '\n\n\n' + blocks.join('\n\n\n') + '\n';
}

export function goField(k) {
  const words = String(k)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
  let r = words.map((w) => (GO_INIT.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join('');
  if (!r) r = 'Field';
  if (/^\d/.test(r)) r = 'F' + r;
  return r;
}
function go(root, names, o) {
  let time = false;
  const expr = (t) => {
    const ps = prims(t).filter((p) => p !== 'null'),
      nullable = t.prims.has('null');
    const kinds = ps.length + (t.obj ? 1 : 0) + (t.arr ? 1 : 0);
    if (kinds !== 1) return { ty: 'any', ptr: false };
    if (t.arr) return { ty: `[]${expr(t.arr).ty}`, ptr: false };
    if (t.obj) return { ty: t.obj.name, ptr: nullable };
    const p = ps[0];
    if (p === 'string' && o.dates && t.fmt === 'date-time') {
      time = true;
      return { ty: 'time.Time', ptr: nullable };
    }
    return { ty: { string: 'string', integer: 'int64', number: 'float64', boolean: 'bool' }[p], ptr: nullable };
  };
  const blocks = names.map(({ name, obj }) => {
    const used = new Set();
    const rows = [...obj.keys].map(([k, v]) => {
      let f = goField(k);
      for (let i = 2; used.has(f); i++) f = goField(k) + i;
      used.add(f);
      const e = expr(v),
        opt = obj.seen.get(k) < obj.n;
      const ty = (e.ptr || (opt && e.ty !== 'any' && !e.ty.startsWith('[]')) ? '*' : '') + e.ty;
      const note = o.dates && v.fmt === 'date' ? ' // date (YYYY-MM-DD)' : '';
      return [f, ty, `\`json:"${k.replace(/[`"]/g, '')}${opt || e.ptr ? ',omitempty' : ''}"\`${note}`];
    });
    const w1 = Math.max(0, ...rows.map((r) => r[0].length)),
      w2 = Math.max(0, ...rows.map((r) => r[1].length));
    return `type ${name} struct {\n${rows.map(([a, b, c]) => `\t${a.padEnd(w1)} ${b.padEnd(w2)} ${c}`).join('\n')}${rows.length ? '\n' : ''}}`;
  });
  if (!root.obj || root.prims.size || root.arr) blocks.unshift(`type ${o.aliasName} ${expr(root).ty}`);
  return `package main\n\n${time ? 'import "time"\n\n' : ''}${blocks.join('\n\n')}\n`;
}

/**
 * opts: { lang: 'ts'|'schema'|'python'|'go', rootName, style: 'interface'|'type', readonly, dates, py: 'typeddict'|'dataclass' }
 */
export function generate(value, opts = {}) {
  const o = { lang: 'ts', rootName: 'Root', style: 'interface', readonly: false, dates: true, py: 'typeddict', ...opts };
  o.rootName = pascal(o.rootName || 'Root');
  const root = infer(value);
  o.aliasName = root.arr ? o.rootName + 'List' : o.rootName; // [{..}] -> Root items, RootList alias
  const names = nameAll(root, o.rootName);
  return { ts, schema, python, go }[o.lang](root, names, o);
}
