// Pure line/word diff (LCS). No DOM.
const ID = (x) => x;

/** Edit script over two arrays: [{t:'eq'|'del'|'add', i, j}] (i/j index into a/b; del has i, add has j, eq both). */
export function diffSeq(a, b, key = ID) {
  const ka = a.map(key),
    kb = b.map(key),
    ops = [];
  let s = 0,
    ea = a.length,
    eb = b.length;
  while (s < ea && s < eb && ka[s] === kb[s]) s++;
  while (ea > s && eb > s && ka[ea - 1] === kb[eb - 1]) {
    ea--;
    eb--;
  }
  for (let k = 0; k < s; k++) ops.push({ t: 'eq', i: k, j: k });
  const n = ea - s,
    m = eb - s,
    w = m + 1;
  // ponytail: O(n*m) table; past ~25M cells the middle is shown as one delete + one add. Myers would lift the cap.
  if (n * m > 25e6) {
    for (let i = s; i < ea; i++) ops.push({ t: 'del', i });
    for (let j = s; j < eb; j++) ops.push({ t: 'add', j });
  } else {
    const L = new Uint32Array((n + 1) * w); // L[x*w+y] = LCS of a[s+x..], b[s+y..]
    for (let x = n - 1; x >= 0; x--)
      for (let y = m - 1; y >= 0; y--) L[x * w + y] = ka[s + x] === kb[s + y] ? L[(x + 1) * w + y + 1] + 1 : Math.max(L[(x + 1) * w + y], L[x * w + y + 1]);
    let x = 0,
      y = 0;
    while (x < n || y < m) {
      if (x < n && y < m && ka[s + x] === kb[s + y]) {
        ops.push({ t: 'eq', i: s + x, j: s + y });
        x++;
        y++;
      } else if (y >= m || (x < n && L[(x + 1) * w + y] >= L[x * w + y + 1])) {
        ops.push({ t: 'del', i: s + x });
        x++;
      } else {
        ops.push({ t: 'add', j: s + y });
        y++;
      }
    }
  }
  for (let k = 0; ea + k < a.length; k++) ops.push({ t: 'eq', i: ea + k, j: eb + k });
  return ops;
}

export const lines = (text) => {
  if (!text) return [];
  const l = text.split(/\r?\n/);
  if (l[l.length - 1] === '') l.pop();
  return l;
};

const tokens = (s) => s.match(/\s+|\w+|[^\w\s]/gu) ?? [];
const wsKey = (s) => (/^\s+$/.test(s) ? ' ' : s);

/** Word-level segments for a changed line pair: {a:[{text,changed}], b:[...]}. */
export function words(a, b, ignoreWs = false) {
  const ta = tokens(a),
    tb = tokens(b),
    A = [],
    B = [];
  const push = (arr, text, changed) =>
    arr.length && arr[arr.length - 1].changed === changed ? (arr[arr.length - 1].text += text) : arr.push({ text, changed });
  for (const o of diffSeq(ta, tb, ignoreWs ? wsKey : ID)) {
    if (o.t !== 'add') push(A, ta[o.i], o.t === 'del');
    if (o.t !== 'del') push(B, tb[o.j], o.t === 'add');
  }
  return { a: A, b: B };
}

/**
 * Line diff → rows [{t:'eq'|'del'|'add'|'chg', l, r}] where l/r = {n (1-based), text, segs?} or null.
 * Runs of deletions followed by additions are paired line-by-line into 'chg' rows with word segments.
 */
export function diff(aText, bText, { ignoreWs = false } = {}) {
  const a = lines(aText),
    b = lines(bText),
    rows = [];
  const side = (arr, k) => ({ n: k + 1, text: arr[k] });
  const ops = diffSeq(a, b, ignoreWs ? (s) => s.replace(/\s+/g, ' ').trim() : ID);
  for (let p = 0; p < ops.length;) {
    if (ops[p].t === 'eq') {
      rows.push({ t: 'eq', l: side(a, ops[p].i), r: side(b, ops[p].j) });
      p++;
      continue;
    }
    const dels = [],
      adds = [];
    while (p < ops.length && ops[p].t === 'del') dels.push(ops[p++].i);
    while (p < ops.length && ops[p].t === 'add') adds.push(ops[p++].j);
    for (let k = 0; k < Math.max(dels.length, adds.length); k++) {
      const l = k < dels.length ? side(a, dels[k]) : null,
        r = k < adds.length ? side(b, adds[k]) : null;
      if (l && r) {
        const w = words(l.text, r.text, ignoreWs);
        l.segs = w.a;
        r.segs = w.b;
      }
      rows.push({ t: l && r ? 'chg' : l ? 'del' : 'add', l, r });
    }
  }
  return { rows, added: rows.filter((r) => r.r && r.t !== 'eq').length, removed: rows.filter((r) => r.l && r.t !== 'eq').length };
}

/** Collapses runs of unchanged rows, keeping `ctx` rows around each change: runs become {t:'skip', count}. */
export function fold(rows, ctx = 3) {
  const out = [];
  for (let i = 0; i < rows.length;) {
    if (rows[i].t !== 'eq') {
      out.push(rows[i++]);
      continue;
    }
    let j = i;
    while (j < rows.length && rows[j].t === 'eq') j++;
    const head = i === 0 ? 0 : ctx,
      tail = j === rows.length ? 0 : ctx;
    if (j - i > head + tail + 1) out.push(...rows.slice(i, i + head), { t: 'skip', count: j - i - head - tail }, ...rows.slice(j - tail, j));
    else out.push(...rows.slice(i, j));
    i = j;
  }
  return out;
}
