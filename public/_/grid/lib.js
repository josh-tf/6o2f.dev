// CSS grid builder state -> CSS/HTML. Pure functions, no DOM.

/** Split a track list on top-level whitespace, keeping minmax(...)/repeat(...) together. Returns null on unbalanced parentheses. */
export function splitTracks(str) {
  const out = [];
  let depth = 0,
    cur = '';
  for (const ch of String(str).trim()) {
    if (ch === '(') depth++;
    if (ch === ')' && --depth < 0) return null;
    if (/\s/.test(ch) && depth === 0) {
      if (cur) out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (depth) return null;
  if (cur) out.push(cur);
  return out;
}

const LEN = '(?:0|\\d*\\.?\\d+(?:px|%|em|rem|vw|vh|ch))';
const FLEX = '\\d*\\.?\\d+fr';
const FIXED = new RegExp(`^${LEN}$`);
const SIMPLE = new RegExp(`^(?:auto|min-content|max-content|${LEN}|${FLEX}|fit-content\\(${LEN}\\))$`);
const MINMAX = new RegExp(`^minmax\\(\\s*(auto|min-content|max-content|${LEN})\\s*,\\s*(auto|min-content|max-content|${LEN}|${FLEX})\\s*\\)$`);
const isTrack = (t) => SIMPLE.test(t) || MINMAX.test(t);
const isFixedTrack = (t) => FIXED.test(t) || (MINMAX.test(t) && (FIXED.test(t.match(MINMAX)[1]) || FIXED.test(t.match(MINMAX)[2])));

/** Validate a grid-template-columns/rows value. Returns { ok, count, auto, error }; count is null when repeat(auto-fit/auto-fill) makes it depend on width. */
export function parseTracks(str) {
  const parts = splitTracks(str);
  if (!parts) return { ok: false, error: 'Unbalanced parentheses.' };
  if (!parts.length) return { ok: true, count: 0, auto: false };
  let count = 0,
    auto = false;
  for (const p of parts) {
    const rep = p.match(/^repeat\(\s*(auto-fit|auto-fill|\d+)\s*,\s*(.+)\)$/);
    if (rep) {
      const inner = splitTracks(rep[2]);
      if (!inner?.length || !inner.every(isTrack)) return { ok: false, error: `"${p}" has an invalid track inside repeat().` };
      if (/^auto/.test(rep[1])) {
        if (auto) return { ok: false, error: 'Only one repeat(auto-fit/auto-fill) is allowed.' };
        if (!inner.every(isFixedTrack)) return { ok: false, error: `repeat(${rep[1]}) needs a fixed size, e.g. minmax(160px, 1fr).` };
        auto = true;
      } else {
        const n = Number(rep[1]);
        if (n < 1 || n > 100) return { ok: false, error: 'repeat() count must be 1 to 100.' };
        count += n * inner.length;
      }
    } else if (isTrack(p)) count++;
    else return { ok: false, error: `"${p}" is not a track size. Use fr, px, %, auto, minmax() or repeat().` };
  }
  return { ok: true, count: auto ? null : count, auto };
}

export const slug = (label, i) =>
  String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/^(\d)/, 'a$1') || `item${i + 1}`;
const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Item: { label, auto, c1, c2, r1, r2 } with 1-based grid lines (end exclusive). */
export const item = (label, c1, c2, r1, r2) => (c1 ? { label, auto: false, c1, c2, r1, r2 } : { label, auto: true, c1: 1, c2: 2, r1: 1, r2: 2 });

/** grid-template-areas rows, or a reason they cannot be used. cols/rows = explicit track counts (null when width-dependent). */
export function areas(s, cols, rows) {
  if (cols == null) return { why: 'Named areas need a fixed number of columns (not auto-fit/auto-fill).' };
  if (s.items.some((it) => it.auto)) return { why: 'Named areas need every item placed, not auto-placed.' };
  const names = s.items.map((it, i) => slug(it.label, i));
  if (new Set(names).size !== names.length) return { why: 'Two items have the same name.' };
  const C = Math.max(cols, ...s.items.map((it) => it.c2 - 1)),
    R = Math.max(rows ?? 0, ...s.items.map((it) => it.r2 - 1));
  if (!C || !R) return { why: 'Add some columns and rows first.' };
  const m = Array.from({ length: R }, () => Array(C).fill('.'));
  for (const [i, it] of s.items.entries())
    for (let r = it.r1; r < it.r2; r++)
      for (let c = it.c1; c < it.c2; c++) {
        if (m[r - 1][c - 1] !== '.') return { why: `"${it.label}" overlaps another item, which named areas cannot express.` };
        m[r - 1][c - 1] = names[i];
      }
  const w = Array.from({ length: C }, (_, c) => Math.max(...m.map((row) => row[c].length)));
  return {
    rows: m.map(
      (row) =>
        `"${row
          .map((v, c) => v.padEnd(w[c]))
          .join(' ')
          .trimEnd()}"`,
    ),
    names,
  };
}

const line = (a, b) => (b - a === 1 ? `${a}` : `${a} / ${b}`);
export function css(s, cols, rows, useAreas = true) {
  const d = ['  display: grid;'];
  if (s.columns.trim()) d.push(`  grid-template-columns: ${s.columns.trim()};`);
  if (s.rows.trim()) d.push(`  grid-template-rows: ${s.rows.trim()};`);
  if (s.autoRows.trim()) d.push(`  grid-auto-rows: ${s.autoRows.trim()};`);
  const a = useAreas ? areas(s, cols, rows) : { why: 'off' };
  if (a.rows) d.push(`  grid-template-areas:\n${a.rows.map((r) => `    ${r}`).join('\n')};`);
  if (s.rowGap || s.colGap) d.push(`  gap: ${s.rowGap === s.colGap ? `${s.rowGap}px` : `${s.rowGap}px ${s.colGap}px`};`);
  const out = [`.grid {\n${d.join('\n')}\n}`];
  s.items.forEach((it, i) => {
    if (a.rows) out.push(`.${a.names[i]} { grid-area: ${a.names[i]}; }`);
    else if (!it.auto) out.push(`.item-${i + 1} {\n  grid-column: ${line(it.c1, it.c2)};\n  grid-row: ${line(it.r1, it.r2)};\n}`);
  });
  return { css: out.join('\n\n') + '\n', areas: !!a.rows, why: a.why };
}
export function html(s, useAreaNames) {
  return `<div class="grid">\n${s.items.map((it, i) => `  <div class="${useAreaNames ? slug(it.label, i) : `item item-${i + 1}`}">${escHtml(it.label || `Item ${i + 1}`)}</div>`).join('\n')}\n</div>\n`;
}

const base = { rows: '', autoRows: '', rowGap: 12, colGap: 12 };
export const PRESETS = {
  grail: {
    name: 'Holy grail',
    make: () => ({
      ...base,
      columns: '160px 1fr 160px',
      rows: 'auto 1fr auto',
      items: [item('Header', 1, 4, 1, 2), item('Nav', 1, 2, 2, 3), item('Main', 2, 3, 2, 3), item('Aside', 3, 4, 2, 3), item('Footer', 1, 4, 3, 4)],
    }),
  },
  dashboard: {
    name: 'Dashboard',
    make: () => ({
      ...base,
      columns: 'repeat(4, 1fr)',
      rows: 'auto repeat(2, 120px)',
      items: [item('Top bar', 1, 5, 1, 2), item('Sales', 1, 2, 2, 3), item('Users', 2, 3, 2, 3), item('Chart', 3, 5, 2, 4), item('Orders', 1, 3, 3, 4)],
    }),
  },
  magazine: {
    name: 'Magazine',
    make: () => ({
      ...base,
      columns: 'repeat(6, 1fr)',
      rows: 'repeat(3, 110px)',
      items: [
        item('Feature', 1, 4, 1, 3),
        item('Story', 4, 7, 1, 2),
        item('Opinion', 4, 7, 2, 3),
        item('Brief A', 1, 3, 3, 4),
        item('Brief B', 3, 5, 3, 4),
        item('Ad', 5, 7, 3, 4),
      ],
    }),
  },
  gallery: {
    name: 'Gallery',
    make: () => ({
      ...base,
      columns: 'repeat(auto-fill, minmax(140px, 1fr))',
      autoRows: '110px',
      items: Array.from({ length: 8 }, (_, i) => item(`Photo ${i + 1}`)),
    }),
  },
};
