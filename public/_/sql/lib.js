// SQL tokenizer, formatter and minifier. Pure functions, no DOM.

const KW = new Set(
  `ADD ALL ALTER ANALYZE AND ANY AS ASC BEGIN BETWEEN BY CASCADE CASE CAST CHECK COLLATE COLUMN COMMIT CONFLICT CONSTRAINT CREATE CROSS
CURRENT_DATE CURRENT_TIME CURRENT_TIMESTAMP DATABASE DEFAULT DELETE DESC DISTINCT DO DROP ELSE END ESCAPE EXCEPT EXISTS EXPLAIN FALSE FETCH FILTER FIRST
FOLLOWING FOR FOREIGN FROM FULL GRANT GROUP HAVING IF IGNORE ILIKE IN INDEX INNER INSERT INTERSECT INTERVAL INTO IS JOIN KEY LAST LATERAL LEFT LIKE LIMIT
MATERIALIZED NATURAL NOT NOTHING NULL NULLS OF OFFSET ON ONLY OR ORDER OUTER OVER PARTITION PRECEDING PRIMARY RANGE RECURSIVE REFERENCES REPLACE RETURNING
REVOKE RIGHT ROLLBACK ROW ROWS SELECT SET SIMILAR TABLE TEMP TEMPORARY THEN TIES TO TRANSACTION TRIGGER TRUE TRUNCATE UNBOUNDED UNION UNIQUE UPDATE USING
VALUES VIEW WHEN WHERE WINDOW WITH WITHIN APPLY DUPLICATE AUTO_INCREMENT AUTOINCREMENT UNSIGNED SCHEMA EXTENSION
BIGINT BINARY BIT BLOB BOOL BOOLEAN CHAR CHARACTER DATE DATETIME DECIMAL DOUBLE FLOAT INT INTEGER JSON JSONB NUMERIC REAL SERIAL BIGSERIAL SMALLINT
TEXT TIME TIMESTAMP TIMESTAMPTZ TINYINT UUID VARCHAR VARYING PRECISION ZONE`.split(/\s+/),
);
// Words that take "(args)" with no space before the paren.
const CALLISH = new Set('CAST CHAR CHARACTER DECIMAL NUMERIC VARCHAR FLOAT TIMESTAMP TIME BIT BINARY IF REPLACE LEFT RIGHT VALUES'.split(' '));
const PHRASES = [
  'INSERT OR REPLACE INTO',
  'INSERT OR IGNORE INTO',
  'ON DUPLICATE KEY UPDATE',
  'IS NOT DISTINCT FROM',
  'IS DISTINCT FROM',
  'NATURAL LEFT OUTER JOIN',
  'NATURAL LEFT JOIN',
  'NATURAL RIGHT JOIN',
  'NATURAL INNER JOIN',
  'NATURAL JOIN',
  'LEFT OUTER JOIN',
  'RIGHT OUTER JOIN',
  'FULL OUTER JOIN',
  'LEFT JOIN',
  'RIGHT JOIN',
  'FULL JOIN',
  'INNER JOIN',
  'CROSS JOIN',
  'CROSS APPLY',
  'OUTER APPLY',
  'GROUP BY',
  'ORDER BY',
  'PARTITION BY',
  'UNION ALL',
  'UNION DISTINCT',
  'INSERT INTO',
  'REPLACE INTO',
  'DELETE FROM',
  'FOR NO KEY UPDATE',
  'FOR KEY SHARE',
  'FOR UPDATE',
  'FOR SHARE',
  'SELECT DISTINCT',
  'SELECT ALL',
  'WITH RECURSIVE',
  'ON CONFLICT',
  'DO UPDATE SET',
  'DO NOTHING',
  'UNION',
  'INTERSECT',
  'EXCEPT',
].map((p) => p.split(' '));
const LIST = new Set([
  'SELECT',
  'SELECT DISTINCT',
  'SELECT ALL',
  'FROM',
  'WHERE',
  'GROUP BY',
  'HAVING',
  'ORDER BY',
  'SET',
  'DO UPDATE SET',
  'VALUES',
  'RETURNING',
  'WITH',
  'WITH RECURSIVE',
  'WINDOW',
]);
const INLINE = new Set([
  'LIMIT',
  'OFFSET',
  'FETCH',
  'UPDATE',
  'INSERT INTO',
  'INSERT OR REPLACE INTO',
  'INSERT OR IGNORE INTO',
  'REPLACE INTO',
  'DELETE FROM',
  'ON CONFLICT',
  'ON DUPLICATE KEY UPDATE',
  'DO NOTHING',
  'FOR UPDATE',
  'FOR SHARE',
  'FOR NO KEY UPDATE',
  'FOR KEY SHARE',
  'UNION',
  'UNION ALL',
  'UNION DISTINCT',
  'INTERSECT',
  'EXCEPT',
]);
const OPS = [
  '->>',
  '#>>',
  '!~*',
  '<=>',
  '<>',
  '!=',
  '<=',
  '>=',
  '||',
  '::',
  '->',
  '#>',
  '@>',
  '<@',
  '&&',
  ':=',
  '==',
  '<<',
  '>>',
  '~*',
  '!~',
  '=',
  '<',
  '>',
  '+',
  '-',
  '*',
  '/',
  '%',
  '^',
  '&',
  '|',
  '~',
  '!',
  '#',
  '@',
];

/**
 * Tokens: {t: 'ws'|'line'|'block'|'str'|'qid'|'num'|'word'|'op'|'punct'|'ph', v, nl?}.
 * dialect 'mysql' reads "..." as a string and allows backslash escapes; E'..' strings always allow them.
 */
export function tokenize(src, dialect = 'generic') {
  const out = [],
    n = src.length,
    my = dialect === 'mysql';
  let i = 0;
  const push = (t, v) => out.push({ t, v });
  const quoted = (q, close, bs) => {
    // returns end index after closing quote, or throws
    let j = i + q;
    for (;;) {
      if (j >= n) throw new SqlError(`Unterminated ${close === "'" ? 'string' : 'quoted identifier'}`, i, src);
      const c = src[j];
      if (bs && c === '\\') {
        j += 2;
        continue;
      }
      if (c === close) {
        if (src[j + 1] === close) {
          j += 2;
          continue;
        }
        return j + 1;
      }
      j++;
    }
  };
  while (i < n) {
    const c = src[i],
      d = src[i + 1];
    let m;
    if (/\s/.test(c)) {
      m = /^\s+/.exec(src.slice(i, i + 1000))[0];
      push('ws', m);
      i += m.length;
      continue;
    }
    if ((c === '-' && d === '-') || (c === '#' && my)) {
      const e = src.indexOf('\n', i);
      const end = e < 0 ? n : e;
      push('line', src.slice(i, end).replace(/\s+$/, ''));
      i = end;
      continue;
    }
    if (c === '/' && d === '*') {
      const e = src.indexOf('*/', i + 2);
      if (e < 0) throw new SqlError('Unterminated /* comment', i, src);
      push('block', src.slice(i, e + 2));
      i = e + 2;
      continue;
    }
    if (/[EeNnXxBb]/.test(c) && d === "'" && !/[\w$]/.test(src[i - 1] ?? '')) {
      // E'..', N'..', X'..', B'..'
      const e = quoted(2, "'", my || c === 'E' || c === 'e');
      push('str', src.slice(i, e));
      i = e;
      continue;
    }
    if (c === "'") {
      const e = quoted(1, "'", my);
      push('str', src.slice(i, e));
      i = e;
      continue;
    }
    if (c === '"') {
      const e = quoted(1, '"', my);
      push(my ? 'str' : 'qid', src.slice(i, e));
      i = e;
      continue;
    }
    if (c === '`') {
      const e = quoted(1, '`', false);
      push('qid', src.slice(i, e));
      i = e;
      continue;
    }
    if (c === '[' && dialect !== 'postgres') {
      // T-SQL / SQLite [identifier]; postgres uses [ ] for arrays
      const e = src.indexOf(']', i);
      if (e < 0) throw new SqlError('Unterminated [identifier]', i, src);
      push('qid', src.slice(i, e + 1));
      i = e + 1;
      continue;
    }
    if (c === '$' && (m = /^\$([A-Za-z_]\w*)?\$/.exec(src.slice(i, i + 64)))) {
      // postgres dollar quoting
      const e = src.indexOf(m[0], i + m[0].length);
      if (e < 0) throw new SqlError('Unterminated dollar-quoted string', i, src);
      push('str', src.slice(i, e + m[0].length));
      i = e + m[0].length;
      continue;
    }
    if ((m = /^(?:0x[0-9a-f]+|(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)/i.exec(src.slice(i, i + 400))) && !/[\w$]/.test(src[i - 1] ?? '')) {
      push('num', m[0]);
      i += m[0].length;
      continue;
    }
    if ((m = /^(?:\?|\$\d+|[:@]{1,2}[A-Za-z_][\w.]*)/.exec(src.slice(i, i + 200))) && !(c === ':' && d === ':')) {
      push('ph', m[0]);
      i += m[0].length;
      continue;
    }
    if ((m = /^[\p{L}_][\p{L}\p{N}_$]*/u.exec(src.slice(i, i + 400)))) {
      push('word', m[0]);
      i += m[0].length;
      continue;
    }
    if ('(),;.[]'.includes(c)) {
      push('punct', c);
      i++;
      continue;
    }
    const op = OPS.find((o) => src.startsWith(o, i));
    if (op) {
      push('op', op);
      i += op.length;
      continue;
    }
    throw new SqlError(`Unexpected character ${JSON.stringify(c)}`, i, src);
  }
  return out;
}

export class SqlError extends Error {
  constructor(msg, at, src) {
    const before = src.slice(0, at),
      line = before.split('\n').length,
      col = at - before.lastIndexOf('\n');
    super(`${msg} at line ${line}, column ${col}`);
    this.at = at;
  }
}

/** Requote a quoted identifier for the dialect; generic keeps it as written. */
function requote(v, dialect) {
  if (dialect === 'generic') return v;
  const o = v[0],
    body =
      o === '['
        ? v.slice(1, -1)
        : v
            .slice(1, -1)
            .split(o + o)
            .join(o);
  const q = dialect === 'mysql' ? '`' : '"';
  return q + body.split(q).join(q + q) + q;
}

/** Merge multi-word keywords, drop whitespace (remembering line breaks before comments). */
function words(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (tk.t === 'ws') continue;
    const nl = i > 0 && tokens[i - 1].t === 'ws' && tokens[i - 1].v.includes('\n');
    if (tk.t === 'word') {
      let hit = null;
      for (const p of PHRASES) {
        let j = i,
          k = 0,
          parts = [];
        while (k < p.length) {
          while (j < tokens.length && tokens[j].t === 'ws') j++;
          if (j >= tokens.length || tokens[j].t !== 'word' || tokens[j].v.toUpperCase() !== p[k]) break;
          parts.push(tokens[j].v);
          j++;
          k++;
        }
        if (k === p.length) {
          hit = { parts, end: j - 1, key: p.join(' ') };
          break;
        }
      }
      if (hit) {
        out.push({ t: 'kw', v: hit.parts, key: hit.key, nl });
        i = hit.end;
        continue;
      }
      const up = tk.v.toUpperCase();
      if (KW.has(up)) {
        out.push({ t: 'kw', v: [tk.v], key: up, nl });
        continue;
      }
    }
    out.push({ ...tk, nl });
  }
  return out;
}

const caseKw = (parts, kc) => parts.map((p) => (kc === 'upper' ? p.toUpperCase() : kc === 'lower' ? p.toLowerCase() : p)).join(' ');

/**
 * Format SQL. opts: { indent: '  ' | '    ' | '\t', keywordCase: 'upper'|'lower'|'preserve', commaFirst: bool, dialect }
 */
export function format(src, opts = {}) {
  const { indent = '  ', keywordCase = 'upper', commaFirst = false, dialect = 'generic' } = opts;
  const toks = words(tokenize(src, dialect));
  const lines = [];
  let line = '',
    lineIndent = 0,
    prev = null,
    unary = false,
    pend = null; // pend: indent of a line break owed before the next token
  // frames: block (root/subquery) = { k: 'block', base }, inline paren = { k: 'paren' }, CASE = { k: 'case', at, inline }
  let stack = [{ k: 'block', base: 0 }],
    content = 1,
    andIndent = 1,
    between = false,
    lastKw = '';
  const top = () => stack[stack.length - 1];
  const block = () => {
    for (let i = stack.length - 1; i >= 0; i--) if (stack[i].k === 'block') return stack[i];
  };
  const atBlock = () => top().k === 'block';
  const flush = () => {
    if (line.trim()) lines.push(indent.repeat(lineIndent) + line);
    line = '';
  };
  const nl = (lvl) => {
    flush();
    lineIndent = lvl;
    pend = null;
  };
  const write = (s, glue = true) => {
    if (pend !== null) nl(pend);
    line += line && glue ? ' ' + s : s;
  };
  const isValue = (t) =>
    t &&
    (t.t === 'word' ||
      t.t === 'qid' ||
      t.t === 'num' ||
      t.t === 'str' ||
      t.t === 'ph' ||
      (t.t === 'punct' && (t.v === ')' || t.v === ']')) ||
      (t.t === 'kw' && /^(NULL|TRUE|FALSE|END|CURRENT_\w+)$/.test(t.key)));

  for (let i = 0; i < toks.length; i++) {
    const tk = toks[i],
      next = toks[i + 1];
    let glue = !unary;
    unary = false;
    if (prev && prev.t === 'punct' && (prev.v === '(' || prev.v === '.' || prev.v === '[')) glue = false;
    if (prev && prev.t === 'op' && prev.v === '::') glue = false;

    if (tk.t === 'line' || tk.t === 'block') {
      const own = tk.nl || (tk.t === 'block' && tk.v.includes('\n'));
      if (own) {
        if (line) nl(pend ?? lineIndent);
        else if (pend !== null) nl(pend);
        line = tk.v;
      } else line += line ? ' ' + tk.v : tk.v; // trailing comment stays on its line; an owed break still follows
      if (tk.t === 'line' || own) pend = pend ?? lineIndent;
      continue; // comments don't change prev
    }
    if (tk.t === 'punct') {
      if (tk.v === ';') {
        line += ';';
        flush();
        lines.push('');
        stack = [{ k: 'block', base: 0 }];
        lineIndent = 0;
        content = andIndent = 1;
        prev = null;
        pend = null;
        between = false;
        continue;
      }
      if (tk.v === '(') {
        const sub = next && next.t === 'kw' && /^(SELECT|WITH|VALUES)/.test(next.key);
        // no space before "(" for calls and types; keep one after a table name (INSERT INTO t (a, b), CREATE TABLE t (...))
        let j = i - 1;
        while (j >= 0 && (toks[j].t === 'word' || toks[j].t === 'qid' || (toks[j].t === 'punct' && toks[j].v === '.'))) j--;
        const tableName = j < i - 1 && toks[j]?.t === 'kw' && /(INTO|TABLE|EXISTS|VIEW|INDEX|ON|REFERENCES)$/.test(toks[j].key);
        const tight = !!prev && !tableName && (prev.t === 'word' || prev.t === 'qid' || (prev.t === 'kw' && CALLISH.has(prev.key)));
        write('(', glue && !tight);
        if (sub) {
          stack.push({ k: 'block', base: lineIndent + 1, outer: lineIndent, saved: [content, andIndent, lastKw] });
          pend = lineIndent + 1;
        } else stack.push({ k: 'paren' });
        prev = tk;
        continue;
      }
      if (tk.v === ')') {
        while (top().k === 'case') stack.pop();
        const f = stack.length > 1 ? stack.pop() : top();
        if (f.k === 'block' && f.outer !== undefined) {
          nl(f.outer);
          line = ')';
          [content, andIndent, lastKw] = f.saved;
        } else write(')', false);
        prev = tk;
        continue;
      }
      if (tk.v === ',') {
        if (atBlock()) {
          if (commaFirst) {
            nl(content);
            line = ', ';
            unary = true;
          } else {
            write(',', false);
            pend = content;
          }
        } else write(',', false);
        prev = tk;
        continue;
      }
      write(tk.v, tk.v === '[' ? false : tk.v === '.' ? false : glue && tk.v !== ']');
      prev = tk;
      continue;
    }
    if (tk.t === 'kw') {
      const k = tk.key,
        text = caseKw(tk.v, keywordCase),
        b = block().base;
      if (atBlock() && LIST.has(k)) {
        nl(b);
        write(text);
        content = andIndent = b + 1;
        pend = b + 1;
        lastKw = k;
        prev = tk;
        between = false;
        continue;
      }
      if (atBlock() && INLINE.has(k)) {
        nl(b);
        write(text);
        content = andIndent = b + 1;
        lastKw = k;
        prev = tk;
        between = false;
        if (/^(UNION|INTERSECT|EXCEPT)/.test(k)) pend = b;
        continue;
      }
      if (atBlock() && / JOIN$|^JOIN$| APPLY$/.test(k)) {
        nl(b + 1);
        write(text);
        content = b + 1;
        lastKw = k;
        prev = tk;
        continue;
      }
      if (atBlock() && k === 'ON' && / JOIN$|^JOIN$/.test(lastKw)) {
        nl(b + 2);
        write(text);
        andIndent = b + 2;
        lastKw = k;
        prev = tk;
        continue;
      }
      if (k === 'BETWEEN') between = true;
      if ((k === 'AND' || k === 'OR') && atBlock()) {
        if (k === 'AND' && between) {
          between = false;
          write(text, glue);
          prev = tk;
          continue;
        }
        nl(andIndent);
        write(text);
        prev = tk;
        continue;
      }
      if (k === 'CASE') {
        write(text, glue);
        stack.push({ k: 'case', at: lineIndent, inline: !atBlock() && top().k !== 'case' ? true : top().k === 'case' ? top().inline : false });
        prev = tk;
        continue;
      }
      if (top().k === 'case' && !top().inline && (k === 'WHEN' || k === 'ELSE')) {
        nl(top().at + 1);
        write(text);
        prev = tk;
        continue;
      }
      if (k === 'END' && top().k === 'case') {
        const f = stack.pop();
        if (!f.inline) nl(f.at);
        write(text, glue);
        prev = tk;
        continue;
      }
      write(text, glue);
      prev = tk;
      continue;
    }
    if (tk.t === 'op') {
      if ((tk.v === '-' || tk.v === '+') && !isValue(prev)) {
        write(tk.v, glue);
        unary = true;
        prev = tk;
        continue;
      }
      if (tk.v === '*' && prev && prev.t === 'punct' && (prev.v === '.' || prev.v === '(')) {
        write('*', false);
        prev = { t: 'word', v: '*' };
        continue;
      }
      write(tk.v, tk.v === '::' ? false : glue);
      prev = tk;
      continue;
    }
    let v = tk.v;
    if (tk.t === 'qid') v = requote(v, dialect);
    if (tk.t === 'str' && prev?.t === 'str' && tk.nl) nl(lineIndent);
    write(v, glue);
    prev = tk;
  }
  flush();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines.join('\n');
}

/** Minify: drop comments (keeping /*! and /*+ hints) and every space that isn't needed. String literals are untouched. */
export function minify(src, opts = {}) {
  const { dialect = 'generic', keepHints = true } = opts;
  const toks = tokenize(src, dialect);
  let out = '',
    prev = null,
    gap = '';
  const wordy = (t) => t && (t.t === 'word' || t.t === 'num' || t.t === 'ph' || t.t === 'qid' || t.t === 'str');
  for (const tk of toks) {
    if (tk.t === 'ws' || tk.t === 'line') {
      gap += tk.t === 'ws' ? tk.v : '\n';
      continue;
    }
    if (tk.t === 'block' && !(keepHints && /^\/\*[!+]/.test(tk.v))) continue;
    let v = tk.t === 'qid' ? requote(tk.v, dialect) : tk.v;
    if (prev) {
      const sep =
        (wordy(prev) && wordy(tk)) ||
        (prev.t === 'op' && tk.t === 'op') ||
        prev.t === 'block' ||
        tk.t === 'block' ||
        (prev.t === 'num' && tk.t === 'punct' && tk.v === '.') ||
        (prev.t === 'punct' && prev.v === ')' && tk.t === 'word') ||
        (prev.t === 'ph' && tk.t === 'op');
      if (sep) out += prev.t === 'str' && tk.t === 'str' && gap.includes('\n') ? '\n' : ' ';
    }
    gap = '';
    out += v;
    prev = tk;
  }
  return out;
}

/** Count statements (semicolon-separated, ignoring empty ones) for the status line. */
export function statements(src, dialect) {
  let n = 0,
    any = false;
  for (const tk of tokenize(src, dialect)) {
    if (tk.t === 'punct' && tk.v === ';') {
      if (any) n++;
      any = false;
    } else if (tk.t !== 'ws' && tk.t !== 'line' && tk.t !== 'block') any = true;
  }
  return n + (any ? 1 : 0);
}
