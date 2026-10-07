// Line pipeline: each step takes string[] and returns string[]. Pure functions, no DOM.

/** "\t", "\n", "\\" in delimiter fields → real characters. */
export const unbackslash = (s) => String(s ?? '').replace(/\\([tnr\\])/g, (_, c) => ({ t: '\t', n: '\n', r: '\r', '\\': '\\' })[c]);

/** Seeded PRNG (mulberry32) so shuffle/sample can be reproduced when a seed is given. */
export function rng(seed) {
  if (seed === '' || seed == null) return Math.random;
  let a = [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 2166136261);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const numOf = (s) => {
  const m = /[-+]?(?:\d[\d,_]*\.?\d*|\.\d+)(?:e[-+]?\d+)?/i.exec(s);
  return m ? parseFloat(m[0].replace(/[,_]/g, '')) : NaN;
};

function makeRegex(p) {
  try {
    return new RegExp(p.query, p.ci ? 'i' : '');
  } catch (e) {
    throw new Error(`Invalid regular expression: ${e.message.replace(/^Invalid regular expression: /, '')}`, { cause: e });
  }
}

export const OPS = {
  sort: {
    label: 'Sort',
    defaults: { by: 'natural', ci: true, desc: false },
    run(lines, p) {
      const col = new Intl.Collator(undefined, { numeric: p.by === 'natural', sensitivity: p.ci ? 'base' : 'variant' });
      const dir = p.desc ? -1 : 1;
      let cmp;
      if (p.by === 'numeric') {
        const keyed = lines.map((l, i) => ({ l, n: numOf(l), i }));
        keyed.sort((a, b) => (isNaN(a.n) !== isNaN(b.n) ? (isNaN(a.n) ? 1 : -1) : isNaN(a.n) ? col.compare(a.l, b.l) * dir : (a.n - b.n) * dir || a.i - b.i));
        return keyed.map((k) => k.l); // lines with no number stay at the end either way
      }
      if (p.by === 'length') cmp = (a, b) => ([...a].length - [...b].length) * dir || col.compare(a, b);
      else cmp = (a, b) => col.compare(a, b) * dir;
      return [...lines].sort(cmp);
    },
  },
  shuffle: {
    label: 'Shuffle',
    defaults: { seed: '' },
    run(lines, p) {
      const r = rng(p.seed),
        a = [...lines];
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
  },
  dedupe: {
    label: 'Remove duplicates',
    defaults: { ci: false, trim: false, counts: false },
    run(lines, p) {
      const seen = new Map();
      for (const l of lines) {
        let k = p.trim ? l.trim() : l;
        if (p.ci) k = k.toLowerCase();
        const e = seen.get(k);
        if (e) e.n++;
        else seen.set(k, { l, n: 1 });
      }
      const out = [...seen.values()];
      if (!p.counts) return out.map((e) => e.l);
      const w = String(out.reduce((m, e) => Math.max(m, e.n), 0)).length; // no spread: 100k+ args overflow the stack
      return out.map((e) => `${String(e.n).padStart(w)} ${e.l}`);
    },
  },
  trim: {
    label: 'Trim whitespace',
    defaults: { side: 'both' },
    run: (lines, p) => lines.map((l) => (p.side === 'start' ? l.trimStart() : p.side === 'end' ? l.trimEnd() : l.trim())),
  },
  noempty: { label: 'Remove empty lines', defaults: { blank: true }, run: (lines, p) => lines.filter((l) => (p.blank ? l.trim() : l) !== '') },
  affix: {
    label: 'Add prefix / suffix',
    defaults: { prefix: '- ', suffix: '' },
    run: (lines, p) => {
      const a = unbackslash(p.prefix),
        b = unbackslash(p.suffix);
      return lines.map((l) => a + l + b);
    },
  },
  number: {
    label: 'Number lines',
    defaults: { start: 1, sep: '. ', pad: false },
    run(lines, p) {
      const s = String(p.start).trim() !== '' && Number.isFinite(+p.start) ? Math.trunc(+p.start) : 1,
        sep = unbackslash(p.sep),
        w = String(s + lines.length - 1).length;
      return lines.map((l, i) => `${p.pad ? String(s + i).padStart(w, '0') : s + i}${sep}${l}`);
    },
  },
  join: { label: 'Join into one line', defaults: { delim: ', ' }, run: (lines, p) => [lines.join(unbackslash(p.delim))] },
  split: {
    label: 'Split lines',
    defaults: { delim: ',', regex: false, trim: true },
    run(lines, p) {
      if (p.delim === '') throw new Error('Split needs a delimiter.');
      const d = p.regex ? makeRegex({ query: p.delim }) : unbackslash(p.delim);
      if (p.regex && d.test('')) throw new Error('The split pattern matches empty text; it would split between every character.');
      const out = [];
      for (const l of lines) for (const part of l.split(d)) if (part !== undefined) out.push(p.trim ? part.trim() : part);
      return out;
    },
  },
  filter: {
    label: 'Keep / drop matching',
    defaults: { query: '', regex: false, ci: true, invert: false },
    run(lines, p) {
      if (p.query === '') return lines;
      let test;
      if (p.regex) {
        const re = makeRegex(p);
        test = (l) => re.test(l);
      } else {
        const q = p.ci ? p.query.toLowerCase() : p.query;
        test = p.ci ? (l) => l.toLowerCase().includes(q) : (l) => l.includes(q);
      }
      return lines.filter((l) => test(l) !== p.invert);
    },
  },
  sample: {
    label: 'Random sample',
    defaults: { n: 10, seed: '' },
    run(lines, p) {
      const n = Math.max(0, Math.trunc(+p.n || 0));
      if (n >= lines.length) return lines;
      const r = rng(p.seed),
        idx = lines.map((_, i) => i);
      for (let i = 0; i < n; i++) {
        const j = i + Math.floor(r() * (idx.length - i));
        [idx[i], idx[j]] = [idx[j], idx[i]];
      }
      return idx
        .slice(0, n)
        .sort((a, b) => a - b)
        .map((i) => lines[i]); // keep original order
    },
  },
  head: {
    label: 'First / last N',
    defaults: { n: 10, from: 'start' },
    run: (lines, p) => {
      const n = Math.max(0, Math.trunc(+p.n || 0));
      return p.from === 'end' ? (n ? lines.slice(-n) : []) : lines.slice(0, n);
    },
  },
  reverse: { label: 'Reverse order', defaults: {}, run: (lines) => [...lines].reverse() },
};

/** Split text into lines (\n, \r\n, \r). A single trailing newline doesn't make an extra empty line. */
export function toLines(text) {
  if (text === '') return [];
  const l = text.split(/\r\n|\r|\n/);
  if (l.length > 1 && l.at(-1) === '') l.pop();
  return l;
}

/** Run steps in order. Returns { lines, counts: [after each step], error: { step, message } | null }. */
export function runPipeline(lines, steps) {
  const counts = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.off) {
      counts.push(lines.length);
      continue;
    }
    try {
      lines = OPS[s.op].run(lines, { ...OPS[s.op].defaults, ...s.p });
    } catch (e) {
      return { lines, counts, error: { step: i, message: e.message } };
    }
    counts.push(lines.length);
  }
  return { lines, counts, error: null };
}
