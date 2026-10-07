// JSONPath: parser + evaluator with a small safe expression language for filters. No eval / new Function.
// Supports $ @ . .. * [n] [-n] [start:end:step] [a,b,'c'] [?(expr)] [?expr] [(expr)] and the RFC 9535 functions
// length() count() match() search() value(). Comparisons against multi-node paths are existential:
// [?(@.tags[*] == "x")] keeps an item if any tag equals "x".

export class PathError extends Error {
  constructor(msg, at) {
    super(`${msg} at position ${at + 1}`);
    this.at = at;
  }
}

// ---------- lexer for the bracket / filter parts ----------
function lex(src) {
  const out = [];
  let i = 0;
  const NAME = /[A-Za-z_$\u0080-￿][\w$\u0080-￿]*/y;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    const at = i;
    if (c === '"' || c === "'") {
      let s = '',
        j = i + 1;
      for (;;) {
        if (j >= src.length) throw new PathError('Unterminated string', at);
        const d = src[j];
        if (d === c) break;
        if (d === '\\') {
          const e = src[j + 1];
          const map = { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t', '/': '/', '\\': '\\', "'": "'", '"': '"' };
          if (e === 'u') {
            s += String.fromCharCode(parseInt(src.slice(j + 2, j + 6), 16));
            j += 6;
            continue;
          }
          if (!(e in map)) throw new PathError(`Bad escape \\${e ?? ''}`, j);
          s += map[e];
          j += 2;
          continue;
        }
        s += d;
        j++;
      }
      out.push({ t: 'str', v: s, at });
      i = j + 1;
      continue;
    }
    let m = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(src.slice(i));
    if (m && (c !== '-' || !['num', 'str', 'name', ')', ']', 'path'].includes(out.at(-1)?.t))) {
      out.push({ t: 'num', v: Number(m[0]), raw: m[0], at });
      i += m[0].length;
      continue;
    }
    if (c === '/' && ['op', '(', ',', undefined].includes(out.at(-1)?.t)) {
      // regex literal after =~ or in a function arg
      let j = i + 1,
        cls = false;
      for (; j < src.length; j++) {
        const d = src[j];
        if (d === '\\') {
          j++;
          continue;
        }
        if (d === '[') cls = true;
        else if (d === ']') cls = false;
        else if (d === '/' && !cls) break;
      }
      if (j >= src.length) throw new PathError('Unterminated regular expression', at);
      const flags = /^[gimsuy]*/.exec(src.slice(j + 1))[0];
      try {
        out.push({ t: 'regex', v: new RegExp(src.slice(i + 1, j), flags.replace('g', '')), at });
      } catch (e) {
        throw new PathError(`Bad regular expression: ${e.message}`, at);
      }
      i = j + 1 + flags.length;
      continue;
    }
    m = /^(?:==|!=|<=|>=|=~|&&|\|\||\.\.|[<>!+\-*/%.,:()[\]?@$])/.exec(src.slice(i));
    if (m) {
      const v = m[0];
      const t =
        v === '(' || v === ')' || v === '[' || v === ']' || v === ',' || v === ':' || v === '?' || v === '@' || v === '$' || v === '.' || v === '..' ? v : 'op';
      out.push({ t, v, at });
      i += v.length;
      continue;
    }
    NAME.lastIndex = i;
    if ((m = NAME.exec(src))) {
      out.push({ t: 'name', v: m[0], at });
      i += m[0].length;
      continue;
    }
    throw new PathError(`Unexpected character ${JSON.stringify(c)}`, at);
  }
  out.push({ t: 'eof', at: src.length });
  return out;
}

// ---------- parser ----------
// Path AST: { root: '$' | '@', segs: [{ desc: bool, sels: [sel] }] }
// sel: { k: 'name', v } | { k: 'wild' } | { k: 'index', v } | { k: 'slice', start, end, step } | { k: 'filter', e } | { k: 'script', e }
export function parse(query) {
  const toks = lex(query);
  let p = 0;
  const peek = (o = 0) => toks[p + o],
    next = () => toks[p++];
  const expect = (t) => {
    const k = next();
    if (k.t !== t) throw new PathError(`Expected "${t}" but found ${k.t === 'eof' ? 'the end' : `"${k.v ?? k.t}"`}`, k.at);
    return k;
  };

  function path(inExpr) {
    const r = next();
    const segs = [];
    for (;;) {
      const k = peek();
      if (k.t === '.' || k.t === '..') {
        p++;
        const desc = k.t === '..',
          n = peek();
        if (n.t === 'op' && n.v === '*') {
          p++;
          segs.push({ desc, sels: [{ k: 'wild' }] });
          continue;
        }
        if (n.t === 'name') {
          p++;
          let v = n.v;
          // top-level dot names may contain dashes ($.store.first-name); inside expressions "-" is subtraction
          while (!inExpr && peek().t === 'op' && peek().v === '-' && peek(1).t === 'name' && peek(1).at === peek().at + 1 && peek().at === n.at + v.length) {
            v += '-' + peek(1).v;
            p += 2;
          }
          segs.push({ desc, sels: [{ k: 'name', v }] });
          continue;
        }
        if (n.t === 'num' && Number.isInteger(n.v) && !inExpr) {
          p++;
          segs.push({ desc, sels: [{ k: 'name', v: n.raw }] });
          continue;
        }
        if (desc && n.t === '[') {
          p++;
          segs.push({ desc, sels: bracket() });
          continue;
        }
        throw new PathError(`Expected a name or * after "${k.v}"`, n.at);
      }
      if (k.t === '[') {
        p++;
        segs.push({ desc: false, sels: bracket() });
        continue;
      }
      break;
    }
    return { root: r.t, segs };
  }
  function bracket() {
    const sels = [];
    for (;;) {
      const k = peek();
      if (k.t === 'op' && k.v === '*') {
        p++;
        sels.push({ k: 'wild' });
      } else if (k.t === 'str') {
        p++;
        sels.push({ k: 'name', v: k.v });
      } else if (k.t === '?') {
        p++;
        sels.push({ k: 'filter', e: expr() });
      } else if (k.t === '(') {
        p++;
        const e = expr();
        expect(')');
        sels.push({ k: 'script', e });
      } else if (k.t === 'num' || k.t === ':') {
        const nums = [null, null, null];
        let part = 0;
        while (peek().t !== ',' && peek().t !== ']') {
          const t = next();
          if (t.t === 'eof') throw new PathError('Expected "]"', t.at);
          if (t.t === ':') {
            if (++part > 2) throw new PathError('Too many ":" in slice', t.at);
            continue;
          }
          if (t.t !== 'num' || !Number.isInteger(t.v)) throw new PathError('Expected an integer', t.at);
          if (nums[part] !== null) throw new PathError('Expected ":" , "," or "]"', t.at);
          nums[part] = t.v;
        }
        sels.push(part ? { k: 'slice', start: nums[0], end: nums[1], step: nums[2] ?? 1 } : { k: 'index', v: nums[0] });
      } else if (k.t === 'name') {
        p++;
        sels.push({ k: 'name', v: k.v });
      } // lenient: [name]
      else throw new PathError(`Unexpected ${k.t === 'eof' ? 'end of query' : `"${k.v ?? k.t}"`} in brackets`, k.at);
      const s = next();
      if (s.t === ']') return sels;
      if (s.t !== ',') throw new PathError('Expected "," or "]"', s.at);
    }
  }
  // expression precedence: || < && < ! < comparison < + - < * / % < unary - < primary
  function expr() {
    let l = and();
    while (peek().t === 'op' && peek().v === '||') {
      p++;
      l = { k: 'or', l, r: and() };
    }
    return l;
  }
  function and() {
    let l = not();
    while (peek().t === 'op' && peek().v === '&&') {
      p++;
      l = { k: 'and', l, r: not() };
    }
    return l;
  }
  function not() {
    if (peek().t === 'op' && peek().v === '!') {
      p++;
      return { k: 'not', e: not() };
    }
    return cmp();
  }
  function cmp() {
    const l = add();
    const k = peek();
    if (k.t === 'op' && ['==', '!=', '<', '<=', '>', '>=', '=~'].includes(k.v)) {
      p++;
      return { k: 'cmp', op: k.v, l, r: add() };
    }
    return l;
  }
  function add() {
    let l = mul();
    while (peek().t === 'op' && (peek().v === '+' || peek().v === '-')) {
      const op = next().v;
      l = { k: 'arith', op, l, r: mul() };
    }
    return l;
  }
  function mul() {
    let l = unary();
    while (peek().t === 'op' && ['*', '/', '%'].includes(peek().v)) {
      const op = next().v;
      l = { k: 'arith', op, l, r: unary() };
    }
    return l;
  }
  function unary() {
    if (peek().t === 'op' && peek().v === '-') {
      p++;
      return { k: 'arith', op: '-', l: { k: 'lit', v: 0 }, r: unary() };
    }
    return primary();
  }
  function primary() {
    const k = peek();
    if (k.t === 'num' || k.t === 'str') {
      p++;
      return { k: 'lit', v: k.v };
    }
    if (k.t === 'regex') {
      p++;
      return { k: 'lit', v: k.v };
    }
    if (k.t === '(') {
      p++;
      const e = expr();
      expect(')');
      return e;
    }
    if (k.t === '@' || k.t === '$') return { k: 'path', path: path(true) };
    if (k.t === 'name') {
      p++;
      if (k.v === 'true' || k.v === 'false') return { k: 'lit', v: k.v === 'true' };
      if (k.v === 'null') return { k: 'lit', v: null };
      if (peek().t === '(' && FUNCS[k.v]) {
        p++;
        const args = [];
        if (peek().t !== ')')
          for (;;) {
            args.push(expr());
            if (peek().t === ',') {
              p++;
              continue;
            }
            break;
          }
        expect(')');
        if (args.length !== FUNCS[k.v].n) throw new PathError(`${k.v}() takes ${FUNCS[k.v].n} argument${FUNCS[k.v].n === 1 ? '' : 's'}`, k.at);
        return { k: 'fn', name: k.v, args };
      }
      throw new PathError(`Unknown name "${k.v}" (paths start with @ or $)`, k.at);
    }
    throw new PathError(`Unexpected ${k.t === 'eof' ? 'end of query' : `"${k.v ?? k.t}"`}`, k.at);
  }

  const first = peek();
  if (first.t !== '$') throw new PathError('A query starts with $', first.at);
  const ast = path(false);
  if (peek().t !== 'eof') throw new PathError(`Unexpected "${peek().v ?? peek().t}"`, peek().at);
  return ast;
}

// ---------- evaluation ----------
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const NOTHING = Symbol('nothing');

/** RFC 9535 normalized path: $['a'][0]['it\'s'] */
export function normPath(parts) {
  return (
    '$' +
    parts
      .map((k) =>
        typeof k === 'number'
          ? `[${k}]`
          : `['${String(k)
              .replace(/[\\']/g, (c) => '\\' + c)
              .replace(
                /[\u0000-\u001f]/g,
                (c) => ({ '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' })[c] ?? `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
              )}']`,
      )
      .join('')
  );
}

function children(node) {
  if (Array.isArray(node.v)) return node.v.map((v, i) => ({ v, p: [...node.p, i] }));
  if (isObj(node.v)) return Object.keys(node.v).map((k) => ({ v: node.v[k], p: [...node.p, k] }));
  return [];
}
function* descend(node) {
  yield node;
  for (const c of children(node)) yield* descend(c);
}

function slice(len, start, end, step) {
  const out = [];
  if (step === 0) return out;
  const norm = (i) => (i < 0 ? len + i : i);
  if (step > 0) {
    const lo = Math.min(Math.max(norm(start ?? 0), 0), len),
      hi = Math.min(Math.max(norm(end ?? len), 0), len);
    for (let i = lo; i < hi; i += step) out.push(i);
  } else {
    const hi = Math.min(Math.max(norm(start ?? len - 1), -1), len - 1),
      lo = Math.min(Math.max(end === null ? -1 : norm(end), -1), len - 1);
    for (let i = hi; i > lo; i += step) out.push(i);
  }
  return out;
}

function select(sel, node, root, inExpr) {
  const v = node.v;
  switch (sel.k) {
    case 'name':
      if (isObj(v) && Object.hasOwn(v, sel.v)) return [{ v: v[sel.v], p: [...node.p, sel.v] }];
      if (inExpr && sel.v === 'length' && (Array.isArray(v) || typeof v === 'string')) return [{ v: v.length, p: [...node.p, 'length'] }]; // goessner-style @.length
      return [];
    case 'wild':
      return children(node);
    case 'index': {
      if (!Array.isArray(v)) return [];
      const i = sel.v < 0 ? v.length + sel.v : sel.v;
      return i >= 0 && i < v.length ? [{ v: v[i], p: [...node.p, i] }] : [];
    }
    case 'slice':
      return Array.isArray(v) ? slice(v.length, sel.start, sel.end, sel.step).map((i) => ({ v: v[i], p: [...node.p, i] })) : [];
    case 'filter':
      return children(node).filter((c) => truthy(evalExpr(sel.e, c, root)));
    case 'script': {
      const r = single(evalExpr(sel.e, node, root));
      if (typeof r === 'number' && Number.isInteger(r)) return select({ k: 'index', v: r }, node, root, inExpr);
      if (typeof r === 'string') return select({ k: 'name', v: r }, node, root, inExpr);
      return [];
    }
  }
}

function run(ast, cur, root, inExpr) {
  let nodes = [ast.root === '$' ? root : cur];
  for (const seg of ast.segs) {
    const next = [];
    for (const n of nodes) for (const m of seg.desc ? descend(n) : [n]) for (const s of seg.sels) for (const x of select(s, m, root, inExpr)) next.push(x); // no push(...big): it overflows the stack
    nodes = next;
  }
  return nodes;
}

// expression values are either plain values or { list: nodes } from paths
const single = (x) => (x && x.list ? (x.list.length === 1 ? x.list[0].v : NOTHING) : x);
const values = (x) => (x && x.list ? x.list.map((n) => n.v) : [x]);
function truthy(x) {
  if (x && x.list) return x.list.length > 0; // existence test
  return x !== NOTHING && x !== false && x !== null && x !== undefined && x !== 0 && x !== '';
}
function equal(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a),
    kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && equal(a[k], b[k]));
}
function compare(op, a, b) {
  switch (op) {
    case '==':
      return equal(a, b);
    case '!=':
      return !equal(a, b);
    case '=~':
      return typeof a === 'string' && b instanceof RegExp && b.test(a);
    default: {
      if (!((typeof a === 'number' && typeof b === 'number') || (typeof a === 'string' && typeof b === 'string'))) return false;
      return op === '<' ? a < b : op === '<=' ? a <= b : op === '>' ? a > b : a >= b;
    }
  }
}
const FUNCS = {
  length: {
    n: 1,
    f: (x) => {
      const v = single(x);
      return typeof v === 'string' ? [...v].length : Array.isArray(v) ? v.length : isObj(v) ? Object.keys(v).length : NOTHING;
    },
  },
  count: { n: 1, f: (x) => (x && x.list ? x.list.length : 1) },
  value: { n: 1, f: (x) => single(x) },
  match: {
    n: 2,
    f: (x, r) => {
      const v = single(x),
        re = toRe(single(r));
      return typeof v === 'string' && !!re && new RegExp(`^(?:${re.source})$`, re.flags).test(v);
    },
  },
  search: {
    n: 2,
    f: (x, r) => {
      const v = single(x),
        re = toRe(single(r));
      return typeof v === 'string' && !!re && re.test(v);
    },
  },
};
function toRe(r) {
  if (r instanceof RegExp) return r;
  if (typeof r !== 'string') return null;
  try {
    return new RegExp(r, 'u');
  } catch {
    return null;
  }
}

function evalExpr(e, node, root) {
  switch (e.k) {
    case 'lit':
      return e.v;
    case 'path':
      return { list: run(e.path, node, root, true) };
    case 'not':
      return !truthy(evalExpr(e.e, node, root));
    case 'and':
      return truthy(evalExpr(e.l, node, root)) && truthy(evalExpr(e.r, node, root));
    case 'or':
      return truthy(evalExpr(e.l, node, root)) || truthy(evalExpr(e.r, node, root));
    case 'fn':
      return FUNCS[e.name].f(...e.args.map((a) => evalExpr(a, node, root)));
    case 'arith': {
      const a = single(evalExpr(e.l, node, root)),
        b = single(evalExpr(e.r, node, root));
      if (e.op === '+' && typeof a === 'string' && typeof b === 'string') return a + b;
      if (typeof a !== 'number' || typeof b !== 'number') return NOTHING;
      return e.op === '+' ? a + b : e.op === '-' ? a - b : e.op === '*' ? a * b : e.op === '/' ? a / b : a % b;
    }
    case 'cmp': {
      const l = evalExpr(e.l, node, root),
        r = evalExpr(e.r, node, root);
      const lv = values(l).filter((v) => v !== NOTHING),
        rv = values(r).filter((v) => v !== NOTHING);
      if (!lv.length || !rv.length) return e.op === '==' ? !lv.length && !rv.length : e.op === '!=' ? lv.length !== rv.length : false;
      if (e.op === '!=') return !lv.some((a) => rv.some((b) => equal(a, b)));
      return lv.some((a) => rv.some((b) => compare(e.op, a, b))); // existential over node lists
    }
  }
}

/** Run a query. Returns [{ path: normalized path string, parts, value }]. */
export function query(json, q) {
  const ast = parse(q.trim());
  return run(ast, null, { v: json, p: [] }, false).map((n) => ({ path: normPath(n.p), parts: n.p, value: n.v }));
}

/** The goessner bookstore document, used for the page example and the tests. */
export const BOOKSTORE = {
  store: {
    book: [
      { category: 'reference', author: 'Nigel Rees', title: 'Sayings of the Century', price: 8.95 },
      { category: 'fiction', author: 'Evelyn Waugh', title: 'Sword of Honour', price: 12.99 },
      { category: 'fiction', author: 'Herman Melville', title: 'Moby Dick', isbn: '0-553-21311-3', price: 8.99 },
      { category: 'fiction', author: 'J. R. R. Tolkien', title: 'The Lord of the Rings', isbn: '0-395-19395-8', price: 22.99 },
    ],
    bicycle: { color: 'red', price: 399 },
  },
};
