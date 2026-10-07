// Folder trees: parse paths / indented lists / ls -R / tree output into nodes, render as text trees or Markdown,
// and turn a drawn tree back into paths. Pure functions, no DOM.
// Node: { name, dir, comment, children: Node[] }

const node = (name, dir = false, comment = '') => ({ name, dir, comment, children: [] });
const TREE_LINE = /(├|└|\|--|`--|\+--|\\--)/;

/** Split "name   # comment" (also // comment). The marker needs a space before it so "C#" and "a//b" survive. */
function splitComment(s) {
  const m = /^(.*?)\s+(?:#|\/\/)\s?(.*)$/.exec(s);
  return m && m[1].trim() ? [m[1].trim(), m[2].trim()] : [s.trim(), ''];
}

function child(parent, name, dir) {
  let c = parent.children.find((x) => x.name === name);
  if (!c) {
    c = node(name, dir);
    parent.children.push(c);
  }
  if (dir) c.dir = true;
  return c;
}

/** Add a "a/b/c.txt" path; a trailing slash marks a directory. Leading ./ and / are dropped; \ is accepted. */
function addPath(root, raw, comment = '') {
  let p = raw
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
  if (p === '.' || p === '') return;
  const dir = p.endsWith('/');
  const parts = p.split('/').filter((x) => x && x !== '.');
  let cur = root;
  parts.forEach((part, i) => {
    cur = child(cur, part, i < parts.length - 1 || dir);
  });
  if (comment) cur.comment = comment;
}

export function detect(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.some((l) => TREE_LINE.test(l))) return 'tree';
  if (lines.some((l) => /^\S.*:$/.test(l)) && lines.some((l) => /^\.?\/?[^\s:]*:$/.test(l))) return 'lsr';
  if (lines.some((l) => /^\s+\S/.test(l))) return 'indent';
  return 'paths';
}

/** Indented list (spaces, tabs, optional - * + bullets). Ragged indentation attaches to the nearest shallower line. */
function parseIndent(text) {
  const root = node(''),
    stack = [{ indent: -1, n: root }];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const m = /^([ \t]*)(?:[-*+]\s+|\d+[.)]\s+)?(.*)$/.exec(line.replace(/\t/g, '    '));
    const indent = m[1].length;
    const [label, comment] = splitComment(m[2].replace(/^\*\*(.*)\*\*$/, '$1').replace(/^`(.*)`$/, '$1'));
    while (stack.length > 1 && stack.at(-1).indent >= indent) stack.pop();
    const parent = stack.at(-1).n;
    if (parent !== root) parent.dir = true;
    const dir = label.endsWith('/');
    const n = node(label.replace(/\/+$/, '') || label, dir, comment);
    parent.children.push(n);
    stack.push({ indent, n });
  }
  return root;
}

/** `ls -R` output: "dir:" headers followed by entry names. */
function parseLsR(text) {
  const root = node('');
  let base = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || /^total \d+/.test(line)) continue;
    const h = /^(.*):$/.exec(line);
    if (h) {
      base = h[1].replace(/^\.\/?/, '').replace(/\/$/, '');
      if (base) addPath(root, base + '/');
      continue;
    }
    // long format (ls -lR): take the last field, mark directories by the leading d
    const long = /^([dlbcps-])[rwxsStT-]{9}[.+@]?\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/.exec(line);
    const names = long ? [long[2].replace(/ -> .*$/, '') + (long[1] === 'd' ? '/' : '')] : line.split(/\s{2,}|\t/);
    for (const n of names) addPath(root, (base ? base + '/' : '') + n);
  }
  return root;
}

function parsePaths(text) {
  const root = node('');
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [p, comment] = splitComment(line);
    addPath(root, p, comment);
  }
  return root;
}

/** Drawn tree (├── └── │, or ASCII |-- `--) → nodes. Depth comes from the column where each name starts. */
export function parseTree(text) {
  const root = node(''),
    stack = [{ col: -1, n: root }];
  let rootLabel = '';
  const lines = text.split(/\r?\n/).filter((l) => l.trim() && !/^(Folder PATH listing|Volume serial number is)/i.test(l.trim())); // Windows `tree` header
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\t/g, '    ');
    const k = /(?:├|└)[─-]+ ?|[|`+\\]--+ ?/.exec(line);
    const col = k ? k.index + k[0].length : /^[\s│|]*/.exec(line)[0].length;
    const [label, comment] = splitComment(line.slice(col));
    if (!label) continue;
    if (i === 0 && !TREE_LINE.test(line) && lines.length > 1) {
      rootLabel = label;
      continue;
    } // "." or "project/"
    if (/^\d+ director(y|ies)(, \d+ files?)?$/.test(label)) continue; // tree's summary line
    while (stack.length > 1 && stack.at(-1).col >= col) stack.pop();
    const parent = stack.at(-1).n;
    if (parent !== root) parent.dir = true;
    const n = node(label.replace(/\/+$/, ''), label.endsWith('/'), comment);
    parent.children.push(n);
    stack.push({ col, n });
  }
  return { root, rootLabel };
}

/** Parse any supported input. Returns { root, format, rootLabel }. */
export function parse(text, format = 'auto') {
  const f = format === 'auto' ? detect(text) : format;
  if (f === 'tree') return { ...parseTree(text), format: f };
  return { root: f === 'indent' ? parseIndent(text) : f === 'lsr' ? parseLsR(text) : parsePaths(text), format: f, rootLabel: '' };
}

function ordered(children, o) {
  let c = [...children];
  if (o.sort) {
    const col = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
    c.sort((a, b) => col.compare(a.name, b.name));
  }
  if (o.dirsFirst) c = [...c.filter((x) => x.dir), ...c.filter((x) => !x.dir)];
  return c;
}

const GLYPHS = { unicode: ['├── ', '└── ', '│   ', '    '], ascii: ['|-- ', '`-- ', '|   ', '    '] };
/** Render as a text tree or Markdown list. Options: style (unicode|ascii|markdown), dirsFirst, sort, slash, comments, root. */
export function render(root, o = {}) {
  const style = o.style || 'unicode',
    rows = [];
  const label = (n) => n.name + (o.slash && n.dir ? '/' : '');
  if (style === 'markdown') {
    const walk = (n, d) =>
      ordered(n.children, o).forEach((c) => {
        rows.push([`${'  '.repeat(d)}- ${label(c)}`, c.comment]);
        walk(c, d + 1);
      });
    if (o.root) {
      rows.push([`- ${o.root}`, '']);
      walk(root, 1);
    } else walk(root, 0);
  } else {
    const [mid, last, pipe, blank] = GLYPHS[style];
    const walk = (n, pre) => {
      const kids = ordered(n.children, o);
      kids.forEach((c, i) => {
        const end = i === kids.length - 1;
        rows.push([pre + (end ? last : mid) + label(c), c.comment]);
        walk(c, pre + (end ? blank : pipe));
      });
    };
    if (o.root) rows.push([o.root, '']);
    walk(root, '');
  }
  if (!o.comments || !rows.some((r) => r[1])) return rows.map((r) => r[0]).join('\n');
  const w = Math.max(...rows.map((r) => [...r[0]].length)) + 2;
  return rows.map(([t, c]) => (c ? t + ' '.repeat(w - [...t].length) + '# ' + c : t)).join('\n');
}

/** Flatten nodes into paths. Directories get a trailing slash; filesOnly drops them. */
export function toPaths(root, { prefix = '', filesOnly = false, comments = false } = {}) {
  const out = [];
  const walk = (n, base) =>
    n.children.forEach((c) => {
      const p = base + c.name;
      if (!(filesOnly && c.dir)) out.push(p + (c.dir ? '/' : '') + (comments && c.comment ? `  # ${c.comment}` : ''));
      walk(c, p + '/');
    });
  walk(root, prefix ? prefix.replace(/\/?$/, '/') : '');
  return out;
}

export function count(root) {
  let dirs = 0,
    files = 0;
  const walk = (n) =>
    n.children.forEach((c) => {
      c.dir ? dirs++ : files++;
      walk(c);
    });
  walk(root);
  return { dirs, files };
}
