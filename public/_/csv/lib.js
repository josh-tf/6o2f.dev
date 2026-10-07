// RFC 4180 CSV <-> JSON helpers (browser + node tests).
export const DELIMS = { comma: ',', semicolon: ';', tab: '\t', pipe: '|' };

/** Most frequent candidate delimiter on the first non-empty line, outside quotes. Defaults to a comma. */
export function detectDelimiter(text) {
  const counts = Object.fromEntries(Object.values(DELIMS).map((d) => [d, 0]));
  let q = false,
    seen = false;
  for (const c of text.replace(/^\uFEFF/, '')) {
    if (c === '"') q = !q;
    else if (!q && (c === '\n' || c === '\r')) {
      if (seen) break;
    } else if (!q) {
      seen = true;
      if (c in counts) counts[c]++;
    } else seen = true;
  }
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return best[1] ? best[0] : ',';
}

/** text -> string[][]. Handles quoted fields, "" escapes, embedded newlines, CRLF/LF/CR. Throws on an unterminated quote. */
export function parseCSV(text, delim = ',') {
  text = text.replace(/^\uFEFF/, '');
  const rows = [];
  let row = [],
    f = '',
    i = 0,
    started = false;
  const endField = () => {
    row.push(f);
    f = '';
    started = false;
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };
  while (i < text.length) {
    const c = text[i];
    if (c === '"' && !started) {
      const line = text.slice(0, i).split(/\r\n|\n|\r/).length;
      started = true;
      i++;
      for (;;) {
        if (i >= text.length) throw new Error(`Unterminated quoted field starting on line ${line}`);
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            f += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        f += text[i++];
      }
      if (i < text.length && text[i] !== delim && text[i] !== '\n' && text[i] !== '\r')
        throw new Error(`Unexpected character after closing quote on line ${text.slice(0, i).split(/\r\n|\n|\r/).length}`);
    } else if (c === delim) {
      endField();
      i++;
    } else if (c === '\n' || c === '\r') {
      endRow();
      i += c === '\r' && text[i + 1] === '\n' ? 2 : 1;
    } else {
      f += c;
      started = true;
      i++;
    }
  }
  if (started || f || row.length) endRow(); // no phantom row after a trailing newline
  return rows;
}

const NUM = /^-?(0|[1-9]\d*)(\.\d+)?([eE][+-]?\d+)?$/;
export const infer = (v) => (NUM.test(v) ? Number(v) : v === 'true' ? true : v === 'false' ? false : v);

/** rows -> array of objects (header=true, first row = keys, duplicates get _2, _3) or array of arrays. */
export function rowsToJSON(rows, header, types) {
  const t = types ? infer : (v) => v;
  if (!header) return rows.map((r) => r.map(t));
  const seen = {},
    keys = (rows[0] || []).map((k) => {
      k ||= 'column';
      seen[k] = (seen[k] || 0) + 1;
      return seen[k] > 1 ? `${k}_${seen[k]}` : k;
    });
  return rows.slice(1).map((r) => Object.fromEntries(r.map((v, i) => [keys[i] ?? `column_${i + 1}`, t(v)])));
}

const cell = (v) => (v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
/** JSON value (array of objects, array of arrays, or one object) -> string[][]; header row only when `header`. */
export function jsonToRows(data, header) {
  if (!Array.isArray(data)) data = [data];
  if (!data.length) return [];
  if (data.every(Array.isArray)) return data.map((r) => r.map(cell));
  if (!data.every((r) => r && typeof r === 'object')) throw new Error('Expected an array of objects or an array of arrays');
  const keys = [...new Set(data.flatMap(Object.keys))];
  return [...(header ? [keys] : []), ...data.map((r) => keys.map((k) => cell(r[k])))];
}

/** string[][] -> CSV text, quoting fields containing the delimiter, a quote or a line break. Lines end with \n. */
export const toCSV = (rows, delim = ',') =>
  rows.map((r) => r.map((v) => (v.includes(delim) || /["\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v)).join(delim)).join('\n');
