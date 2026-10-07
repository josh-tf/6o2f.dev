import { $, esc, mountBar } from '/_/ui.js';
import { query, normPath, BOOKSTORE } from './lib.js';
mountBar('JSONPath');
const EXAMPLES = [
  ['$.store.book[*].author', 'Authors of all books'],
  ['$..author', 'All authors'],
  ['$.store.*', 'Everything in the store'],
  ['$.store..price', 'Every price in the store'],
  ['$..book[2]', 'The third book'],
  ['$..book[-1]', 'The last book'],
  ['$..book[(@.length-1)]', 'The last book (script)'],
  ['$..book[0,1]', 'The first two books (union)'],
  ['$..book[:2]', 'The first two books (slice)'],
  ['$..book[?(@.isbn)]', 'Books with an ISBN'],
  ['$..book[?(@.price < 10)]', 'Books under 10'],
  ['$..book[?(@.price > 10 && @.category == "fiction")].title', 'Fiction over 10'],
  ['$..book[?(@.author =~ /tolkien/i)].title', 'Regex match'],
  ['$..book[?length(@.title) > 15].title', 'Long titles (function)'],
  ['$..*', 'Every node'],
];
const jsonEl = $('#json'),
  qEl = $('#q'),
  rows = $('#rows'),
  status = $('#status');
$('#examples').innerHTML =
  '<option value="">Choose an example…</option>' + EXAMPLES.map(([q, d]) => `<option value="${esc(q)}">${esc(d)}: ${esc(q)}</option>`).join('');
let doc,
  hasDoc = false,
  results = [];
const MAX_ROWS = 500;

function parseJson() {
  $('#jsonerr').textContent = '';
  hasDoc = false;
  if (!jsonEl.value.trim()) {
    $('#tree').innerHTML = '<p class="muted">Paste JSON on the left to explore it.</p>';
    return;
  }
  try {
    doc = JSON.parse(jsonEl.value);
    hasDoc = true;
  } catch (e) {
    const p = /position (\d+)/.exec(e.message),
      m = /line (\d+) column (\d+)/.exec(e.message);
    let where = m ? ` (line ${m[1]}, column ${m[2]})` : '';
    if (!m && p) {
      const b = jsonEl.value.slice(0, +p[1]);
      where = ` (line ${b.split('\n').length}, column ${+p[1] - b.lastIndexOf('\n')})`;
    }
    $('#jsonerr').textContent = `Invalid JSON: ${e.message.replace(/ in JSON at.*| \(line.*/, '')}${where}`;
    $('#tree').innerHTML = '';
    return;
  }
  renderTree();
}
function preview(v) {
  if (Array.isArray(v)) return `Array(${v.length})`;
  if (v && typeof v === 'object') return `{${Object.keys(v).length} key${Object.keys(v).length === 1 ? '' : 's'}}`;
  const s = JSON.stringify(v);
  return s.length > 120 ? s.slice(0, 120) + '…' : s;
}
function runQuery() {
  $('#qerr').textContent = '';
  rows.innerHTML = '';
  results = [];
  if (!hasDoc) {
    status.textContent = '';
    return;
  }
  const q = qEl.value.trim();
  if (!q) {
    status.textContent = 'Type a query, for example $..author';
    return;
  }
  try {
    results = query(doc, q);
  } catch (e) {
    $('#qerr').textContent = `Query error: ${e.message}`;
    status.textContent = '';
    return;
  }
  status.textContent = results.length
    ? `${results.length.toLocaleString()} match${results.length === 1 ? '' : 'es'}${results.length > MAX_ROWS ? `, showing the first ${MAX_ROWS}` : ''}.`
    : 'No matches.';
  rows.innerHTML = results
    .slice(0, MAX_ROWS)
    .map((r, i) => {
      let s = JSON.stringify(r.value, null, 1) ?? 'undefined';
      if (s.length > 400) s = s.slice(0, 400) + '…';
      return `<tr><td>${i}</td><td><code>${esc(r.path)}</code></td><td><code>${esc(s)}</code></td></tr>`;
    })
    .join('');
}
async function copy(text, btn, label) {
  try {
    await navigator.clipboard.writeText(text);
    if (btn) {
      btn.textContent = 'Copied';
      setTimeout(() => (btn.textContent = label), 1500);
    }
    return true;
  } catch {
    // fallback: copy from a temporary textarea, so the query box is never overwritten
    const ta = Object.assign(document.createElement('textarea'), { value: text, readOnly: true });
    ta.className = 'sr';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {}
    ta.remove();
    if (btn) {
      btn.textContent = ok ? 'Copied' : 'Copy failed';
      setTimeout(() => (btn.textContent = label), 1500);
    }
    return ok;
  }
}
$('#copyvals').addEventListener('click', (e) =>
  copy(
    JSON.stringify(
      results.map((r) => r.value),
      null,
      2,
    ),
    e.currentTarget,
    'Copy values',
  ),
);
$('#copypaths').addEventListener('click', (e) => copy(results.map((r) => r.path).join('\n'), e.currentTarget, 'Copy paths'));

// ---- tree: built lazily, one level per expand, so large documents stay fast ----
const CHUNK = 200;
function nodeLi(key, v, parts, open) {
  const li = document.createElement('li');
  const container = v !== null && typeof v === 'object';
  const path = normPath(parts);
  const label = key === null ? '$' : typeof key === 'number' ? `[${key}]` : key;
  li.innerHTML =
    (container ? `<button type="button" class="tg" aria-expanded="false" aria-label="Expand ${esc(label)}"></button>` : '<span class="sp0"></span>') +
    `<button type="button" class="key" data-path="${esc(path)}" aria-label="Copy path ${esc(path)}">${esc(label)}</button> ` +
    `<span class="v${!container && typeof v === 'string' ? ' s' : ''}">${esc(preview(v))}</span>`;
  if (container) {
    const tg = li.firstChild;
    let ul = null;
    const toggle = (want) => {
      const on = want ?? tg.getAttribute('aria-expanded') !== 'true';
      tg.setAttribute('aria-expanded', String(on));
      tg.setAttribute('aria-label', `${on ? 'Collapse' : 'Expand'} ${label}`);
      if (on && !ul) {
        ul = document.createElement('ul');
        li.append(ul);
        fill(ul, v, parts, 0);
      }
      if (ul) ul.hidden = !on;
    };
    tg.addEventListener('click', () => toggle());
    if (open) toggle(true);
  }
  return li;
}
function fill(ul, v, parts, from) {
  const entries = Array.isArray(v) ? v.map((x, i) => [i, x]) : Object.entries(v);
  const depth = parts.length;
  for (const [k, x] of entries.slice(from, from + CHUNK)) ul.append(nodeLi(k, x, [...parts, k], depth < 1));
  if (entries.length > from + CHUNK) {
    const li = document.createElement('li'),
      b = document.createElement('button');
    b.type = 'button';
    b.textContent = `Show ${Math.min(CHUNK, entries.length - from - CHUNK)} more of ${entries.length - from - CHUNK} remaining`;
    b.addEventListener('click', () => {
      li.remove();
      fill(ul, v, parts, from + CHUNK);
    });
    li.append(b);
    ul.append(li);
  }
}
function renderTree() {
  const ul = document.createElement('ul');
  ul.append(nodeLi(null, doc, [], true));
  $('#tree').replaceChildren(ul);
}
$('#tree').addEventListener('click', async (e) => {
  const b = e.target.closest('button.key');
  if (!b) return;
  const ok = await copy(b.dataset.path);
  if (!ok) qEl.value = b.dataset.path; // couldn't copy: put the path where it can be used and copied by hand
  if (!ok) runQuery();
  status.textContent = ok ? `Copied ${b.dataset.path}` : `Couldn't copy; ${b.dataset.path} is now in the query box.`;
});

let t1, t2;
jsonEl.addEventListener('input', () => {
  clearTimeout(t1);
  t1 = setTimeout(
    () => {
      parseJson();
      runQuery();
    },
    jsonEl.value.length > 500000 ? 400 : 120,
  );
});
qEl.addEventListener('input', () => {
  clearTimeout(t2);
  t2 = setTimeout(runQuery, 80);
  $('#examples').value = '';
});
$('#examples').addEventListener('change', (e) => {
  if (e.target.value) {
    qEl.value = e.target.value;
    runQuery();
  }
});
$('#sample').addEventListener('click', () => {
  jsonEl.value = JSON.stringify(BOOKSTORE, null, 2);
  parseJson();
  runQuery();
});
$('#clear').addEventListener('click', () => {
  jsonEl.value = '';
  parseJson();
  runQuery();
  jsonEl.focus();
});
jsonEl.value = JSON.stringify(BOOKSTORE, null, 2);
qEl.value = '$..book[?(@.price < 10)].title';
parseJson();
runQuery();
