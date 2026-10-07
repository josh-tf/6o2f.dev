// Table parsing (CSV/TSV/Markdown/HTML/JSON) and rendering (Markdown/HTML/ASCII/CSV). Pure functions, no DOM.
// A table is { rows: string[][], aligns: ('l'|'c'|'r'|'')[] }; rows[0] is the header.

/** RFC 4180 CSV with quoted fields, doubled quotes and newlines inside quotes. */
export function parseCSV(text, delim = ',') {
  const rows = [];
  let row = [],
    f = '',
    q = false,
    i = 0,
    quotedAt = -1;
  for (; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"' && f === '') {
      q = true;
      quotedAt = i;
    } else if (c === delim) {
      row.push(f);
      f = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(f);
      rows.push(row);
      row = [];
      f = '';
    } else f += c;
  }
  if (q) throw new Error(`A quoted field opened at character ${quotedAt + 1} is never closed.`);
  if (f !== '' || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0] === ''));
}

const SEP = /^\s*\|?\s*:?-{1,}:?\s*(\|\s*:?-{1,}:?\s*)*\|?\s*$/;
function mdCells(line) {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1);
  const cells = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '\\' && s[i + 1] === '|') {
      cur += '|';
      i++;
    } else if (s[i] === '|') {
      cells.push(cur);
      cur = '';
    } else cur += s[i];
  }
  cells.push(cur);
  return cells.map((c) => c.trim().replace(/<br\s*\/?>/gi, '\n'));
}
export function parseMarkdown(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const si = lines.findIndex((l) => SEP.test(l) && l.includes('-'));
  if (si < 1) throw new Error('A Markdown table needs a header row followed by a separator row like |---|---|.');
  const aligns = mdCells(lines[si]).map((c) => (c.startsWith(':') && c.endsWith(':') ? 'c' : c.endsWith(':') ? 'r' : c.startsWith(':') ? 'l' : ''));
  const rows = [mdCells(lines[si - 1]), ...lines.slice(si + 1).map(mdCells)];
  return { rows, aligns };
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
const decode = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : (ENT[e.toLowerCase()] ?? m),
  );
/** HTML <table>: rows from <tr>, cells from <th>/<td>; tags stripped, <br> kept as newlines. colspan repeats the cell as blanks. */
export function parseHTML(text) {
  // ponytail: regex scan, not a full HTML parser; nested tables are flattened.
  const rows = [],
    aligns = [];
  for (const tr of text.matchAll(/<tr(?:\s[^>]*)?>([\s\S]*?)(?=<tr[\s>]|<\/tbody|<\/thead|<\/tfoot|<\/table|$)/gi)) {
    const row = [];
    for (const m of tr[1].matchAll(/<t([hd])(\s[^>]*)?>([\s\S]*?)(?=<t[hd][\s>]|<\/tr|$)/gi)) {
      const attrs = m[2] || '',
        body = m[3].replace(/<\/t[hd]>\s*$/i, '');
      const al = /text-align:\s*(left|center|right)|align="?(left|center|right)/i.exec(attrs);
      if (al && rows.length === 0) aligns[row.length] = (al[1] || al[2])[0].toLowerCase();
      const cell = decode(body.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ''))
        .replace(/[ \t]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
        .trim();
      row.push(cell);
      const span = +(/colspan="?(\d+)/i.exec(attrs)?.[1] || 1);
      for (let k = 1; k < Math.min(span, 50); k++) row.push('');
    }
    if (row.length) rows.push(row);
  }
  if (!rows.length) throw new Error('No <tr> rows with <td> or <th> cells found in the HTML.');
  return { rows, aligns: Array.from({ length: Math.max(...rows.map((r) => r.length)) }, (_, i) => aligns[i] || '') };
}

const str = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
export function parseJSON(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Invalid JSON: ${e.message}`, { cause: e });
  }
  if (data && !Array.isArray(data) && typeof data === 'object') {
    const arr = Object.values(data).find(Array.isArray); // { "items": [...] } wrappers
    data = arr ?? [data];
  }
  if (!Array.isArray(data) || !data.length) throw new Error('JSON must be a non-empty array of objects or of arrays.');
  if (data.every(Array.isArray)) return { rows: data.map((r) => r.map(str)), aligns: [] };
  const keys = [];
  for (const o of data) if (o && typeof o === 'object') for (const k of Object.keys(o)) if (!keys.includes(k)) keys.push(k);
  if (!keys.length) return { rows: [['value'], ...data.map((v) => [str(v)])], aligns: [] };
  const rows = [keys, ...data.map((o) => keys.map((k) => (o && typeof o === 'object' ? str(o[k]) : '')))];
  // numbers right-aligned by default
  const aligns = keys.map((k) =>
    data.every((o) => o == null || typeof o[k] === 'number' || o[k] == null) && data.some((o) => typeof o?.[k] === 'number') ? 'r' : '',
  );
  return { rows, aligns };
}

export function detect(text) {
  const t = text.trim();
  if (/^[[{]/.test(t)) return 'json';
  if (/<t(able|r|d|h)[\s>]/i.test(t)) return 'html';
  const lines = t.split(/\r?\n/);
  if (lines.some((l) => SEP.test(l) && l.includes('-') && l.includes('|')) && lines[0].includes('|')) return 'markdown';
  const first = lines[0];
  if (first.includes('\t')) return 'tsv';
  if ((first.match(/;/g) || []).length > (first.match(/,/g) || []).length) return 'ssv';
  return 'csv';
}

/** Parse any supported format; pads ragged rows so every row has the same column count. */
export function parse(text, format = 'auto') {
  if (!text.trim()) return { rows: [], aligns: [], format };
  const f = format === 'auto' ? detect(text) : format;
  const r =
    f === 'json'
      ? parseJSON(text)
      : f === 'html'
        ? parseHTML(text)
        : f === 'markdown'
          ? parseMarkdown(text)
          : { rows: parseCSV(text, f === 'tsv' ? '\t' : f === 'ssv' ? ';' : ','), aligns: [] };
  return { ...normalize(r.rows, r.aligns), format: f };
}

export function normalize(rows, aligns = []) {
  const w = Math.max(1, ...rows.map((r) => r.length));
  const ragged = rows.some((r) => r.length !== w);
  return { rows: rows.map((r) => [...r, ...Array(w - r.length).fill('')]), aligns: Array.from({ length: w }, (_, i) => aligns[i] || ''), ragged };
}

/** Visible width: wide East Asian characters and emoji count as 2 columns, combining marks as 0. */
export function width(s) {
  let w = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0);
    if (/\p{Mn}|\p{Me}|‍|️/u.test(ch)) continue;
    w +=
      (c >= 0x1100 && c <= 0x115f) ||
      (c >= 0x2e80 && c <= 0xa4cf) ||
      (c >= 0xac00 && c <= 0xd7a3) ||
      (c >= 0xf900 && c <= 0xfaff) ||
      (c >= 0xfe30 && c <= 0xfe4f) ||
      (c >= 0xff00 && c <= 0xff60) ||
      (c >= 0xffe0 && c <= 0xffe6) ||
      (c >= 0x1f300 && c <= 0x1faff) ||
      (c >= 0x20000 && c <= 0x3fffd)
        ? 2
        : 1;
  }
  return w;
}
function pad(s, w, a) {
  const gap = Math.max(0, w - width(s));
  if (a === 'r') return ' '.repeat(gap) + s;
  if (a === 'c') return ' '.repeat(Math.floor(gap / 2)) + s + ' '.repeat(Math.ceil(gap / 2));
  return s + ' '.repeat(gap);
}

const mdEsc = (s) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
export function toMarkdown({ rows, aligns }, { compact = false } = {}) {
  if (!rows.length) return '';
  const cells = rows.map((r) => r.map(mdEsc));
  const w = aligns.map((_, i) => Math.max(3, ...cells.map((r) => width(r[i]))));
  const line = (r) => `| ${r.map((c, i) => (compact ? c : pad(c, w[i], aligns[i]))).join(' | ')} |`;
  const sep = `| ${aligns
    .map((a, i) => {
      const n = compact ? 3 : w[i];
      return a === 'c' ? ':' + '-'.repeat(n - 2) + ':' : a === 'r' ? '-'.repeat(n - 1) + ':' : a === 'l' ? ':' + '-'.repeat(n - 1) : '-'.repeat(n);
    })
    .join(' | ')} |`;
  return [line(cells[0]), sep, ...cells.slice(1).map(line)].join('\n');
}

const h = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]).replace(/\r?\n/g, '<br>');
export function toHTML({ rows, aligns }) {
  if (!rows.length) return '';
  const st = (i) => (aligns[i] ? ` style="text-align: ${{ l: 'left', c: 'center', r: 'right' }[aligns[i]]}"` : '');
  return [
    '<table>',
    '  <thead>',
    `    <tr>${rows[0].map((c, i) => `<th${st(i)}>${h(c)}</th>`).join('')}</tr>`,
    '  </thead>',
    '  <tbody>',
    ...rows.slice(1).map((r) => `    <tr>${r.map((c, i) => `<td${st(i)}>${h(c)}</td>`).join('')}</tr>`),
    '  </tbody>',
    '</table>',
  ].join('\n');
}

const BOX = { unicode: ['┌', '┬', '┐', '├', '┼', '┤', '└', '┴', '┘', '─', '│'], ascii: ['+', '+', '+', '+', '+', '+', '+', '+', '+', '-', '|'] };
/** Box-drawn table; multi-line cells take several text lines. */
export function toASCII({ rows, aligns }, style = 'unicode') {
  if (!rows.length) return '';
  const [tl, tm, tr, ml, mm, mr, bl, bm, br, hz, vt] = BOX[style];
  const split = rows.map((r) => r.map((c) => c.split(/\r?\n/)));
  const w = aligns.map((_, i) => Math.max(1, ...split.flatMap((r) => r[i].map(width))));
  const rule = (l, m, r) => l + w.map((x) => hz.repeat(x + 2)).join(m) + r;
  const out = [rule(tl, tm, tr)];
  split.forEach((r, ri) => {
    const hgt = Math.max(...r.map((c) => c.length));
    for (let k = 0; k < hgt; k++) out.push(vt + r.map((c, i) => ` ${pad(c[k] ?? '', w[i], ri === 0 && !aligns[i] ? 'l' : aligns[i])} `).join(vt) + vt);
    if (ri === 0 && rows.length > 1) out.push(rule(ml, mm, mr));
  });
  out.push(rule(bl, bm, br));
  return out.join('\n');
}

export function toCSV({ rows }, delim = ',') {
  return rows
    .map((r) => r.map((c) => (c.includes(delim) || /["\r\n]/.test(c) || /^\s|\s$/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(delim))
    .join('\r\n');
}
