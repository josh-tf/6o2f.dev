import { $, esc, mountBar } from '/_/ui.js';
import { parseTracks, css, html, item, PRESETS } from '/_/grid/lib.js';
await mountBar('Grid');

const MAX = 24; // items
let s = PRESETS.grail.make(),
  cur = 0,
  out = null;
$('#presets').insertAdjacentHTML(
  'beforeend',
  Object.entries(PRESETS)
    .map(([k, p]) => `<button type="button" data-preset="${k}">${esc(p.name)}</button>`)
    .join(''),
);

const g = $('#g'),
  ov = $('#ov');
const name = (i) => s.items[i].label || `Item ${i + 1}`;

/** Validate a track field; returns true and stores it when the browser and our parser both accept it. */
function track(id, key, prop) {
  const el = $('#' + id),
    v = el.value.trim();
  const p = prop === 'grid-auto-rows' ? { ok: !v || CSS.supports(prop, v) } : parseTracks(v);
  const good = p.ok && (!v || CSS.supports(prop, v));
  $(`#${id}-err`).textContent = good ? '' : p.error || `The browser does not accept "${v}" for ${prop}.`;
  el.setAttribute('aria-invalid', String(!good));
  if (good) s[key] = v;
  return good;
}

function fields() {
  $('#cols').value = s.columns;
  $('#rows').value = s.rows;
  $('#autorows').value = s.autoRows;
  $('#rgap').value = s.rowGap;
  $('#cgap').value = s.colGap;
  for (const id of ['cols', 'rows', 'autorows']) {
    $(`#${id}-err`).textContent = '';
    $('#' + id).removeAttribute('aria-invalid');
  }
}

function render() {
  g.style.cssText = `display:grid;grid-template-columns:${s.columns || 'none'};grid-template-rows:${s.rows || 'none'};grid-auto-rows:${s.autoRows || 'auto'};gap:${s.rowGap}px ${s.colGap}px`;
  g.innerHTML = s.items
    .map(
      (it, i) =>
        `<div class="${i === cur ? 'on' : ''}" style="${it.auto ? '' : `grid-column:${it.c1}/${it.c2};grid-row:${it.r1}/${it.r2}`}">${esc(name(i))}</div>`,
    )
    .join('');
  $('#chips').innerHTML = s.items.map((_, i) => `<button type="button" data-i="${i}" aria-pressed="${i === cur}">${esc(name(i))}</button>`).join('');
  const it = s.items[cur];
  $('#curname').textContent = name(cur);
  if (document.activeElement !== $('#i-label')) $('#i-label').value = it.label;
  for (const [id, k] of [
    ['cs', 'c1'],
    ['ce', 'c2'],
    ['rs', 'r1'],
    ['re', 'r2'],
  ]) {
    if (document.activeElement !== $('#' + id)) $('#' + id).value = it[k];
    $('#' + id).disabled = it.auto;
  }
  $('#auto').checked = it.auto;
  $('#add').disabled = s.items.length >= MAX;
  $('#remove').disabled = s.items.length <= 1;
  overlay();
  code();
}

// The overlay is a second grid with the preview's resolved track sizes, one cell per track intersection.
function overlay() {
  const cs = getComputedStyle(g),
    list = (v) => (v && v !== 'none' ? v.split(' ') : []);
  const cols = list(cs.gridTemplateColumns),
    rows = list(cs.gridTemplateRows);
  ov.style.cssText = `grid-template-columns:${cols.join(' ') || 'none'};grid-template-rows:${rows.join(' ') || 'none'};gap:${s.rowGap}px ${s.colGap}px`;
  let h = '';
  for (let r = 1; r <= rows.length; r++)
    for (let c = 1; c <= cols.length; c++) h += `<i data-c="${c}" data-r="${r}" style="grid-column:${c};grid-row:${r}"></i>`;
  ov.innerHTML = h;
}

function code() {
  const c = parseTracks(s.columns),
    r = parseTracks(s.rows);
  out = css(s, c.ok ? c.count : null, r.ok ? r.count : 0, $('#use-areas').checked);
  $('#o-css').textContent = out.css;
  $('#o-html').textContent = html(s, out.areas);
  $('#areasnote').textContent = $('#use-areas').checked && !out.areas ? `Using line numbers instead: ${out.why}` : '';
}

// Drag to place
let drag = null;
const cellAt = (e) => {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  return el?.parentElement === ov && el.dataset.c ? [Number(el.dataset.c), Number(el.dataset.r)] : null;
};
const span = (a, b) => ({ c1: Math.min(a[0], b[0]), c2: Math.max(a[0], b[0]) + 1, r1: Math.min(a[1], b[1]), r2: Math.max(a[1], b[1]) + 1 });
function mark(sp) {
  for (const el of ov.children) el.classList.toggle('sel', el.dataset.c >= sp.c1 && el.dataset.c < sp.c2 && el.dataset.r >= sp.r1 && el.dataset.r < sp.r2);
}
ov.addEventListener('pointerdown', (e) => {
  const c = cellAt(e);
  if (!c) return;
  e.preventDefault();
  drag = { a: c, b: c };
  ov.setPointerCapture(e.pointerId);
  mark(span(c, c));
});
ov.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const c = cellAt(e);
  if (c) {
    drag.b = c;
    mark(span(drag.a, c));
  }
});
const end = () => {
  if (!drag) return;
  Object.assign(s.items[cur], span(drag.a, drag.b), { auto: false });
  drag = null;
  const it = s.items[cur];
  render();
  say(`Placed ${name(cur)}: columns ${it.c1} to ${it.c2}, rows ${it.r1} to ${it.r2}.`);
};
ov.addEventListener('pointerup', end);
ov.addEventListener('pointercancel', () => {
  drag = null;
  mark({});
});

// Keyboard / form placement
const lines = () => {
  const it = s.items[cur],
    v = (id) => Math.round(Number($('#' + id).value));
  const n = { c1: v('cs'), c2: v('ce'), r1: v('rs'), r2: v('re') };
  if (Object.values(n).some((x) => !Number.isFinite(x) || x < 1 || x > 31)) return;
  if (n.c2 <= n.c1) n.c2 = n.c1 + 1;
  if (n.r2 <= n.r1) n.r2 = n.r1 + 1;
  Object.assign(it, n);
  render();
};
for (const id of ['cs', 'ce', 'rs', 're']) $('#' + id).addEventListener('input', lines);
$('#auto').addEventListener('change', (e) => {
  s.items[cur].auto = e.target.checked;
  render();
});
$('#i-label').addEventListener('input', (e) => {
  s.items[cur].label = e.target.value;
  render();
});
$('#chips').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (b) {
    cur = Number(b.dataset.i);
    render();
    $('#chips').children[cur].focus();
  }
});
$('#add').addEventListener('click', () => {
  s.items.push(item(''));
  cur = s.items.length - 1;
  render();
  say(`Added ${name(cur)}; it is auto-placed until you place it.`);
});
$('#remove').addEventListener('click', () => {
  if (s.items.length < 2) return;
  const n = name(cur);
  s.items.splice(cur, 1);
  cur = Math.min(cur, s.items.length - 1);
  render();
  say(`Removed ${n}.`);
});

$('#cols').addEventListener('input', () => track('cols', 'columns', 'grid-template-columns') && render());
$('#rows').addEventListener('input', () => track('rows', 'rows', 'grid-template-rows') && render());
$('#autorows').addEventListener('input', () => track('autorows', 'autoRows', 'grid-auto-rows') && render());
for (const [id, k] of [
  ['rgap', 'rowGap'],
  ['cgap', 'colGap'],
])
  $('#' + id).addEventListener('input', (e) => {
    const n = Math.round(Number(e.target.value));
    if (e.target.value !== '' && n >= 0 && n <= 200) {
      s[k] = n;
      render();
    }
  });
$('#use-areas').addEventListener('change', code);
const width = () => {
  const pw = $('#pw'),
    avail = Math.max(280, $('.pvwrap').clientWidth - 22);
  pw.max = String(Math.max(Number(pw.min), Math.min(1100, avail)));
  const v = Math.min(Number(pw.value), Number(pw.max));
  $('#stage').style.width = `${v}px`;
  $('#pwo').textContent = `${v}px`;
};
addEventListener('resize', width);
$('#pw').addEventListener('input', width);
new ResizeObserver(() => overlay()).observe(g);
$('#presets').addEventListener('click', (e) => {
  const k = e.target.closest('[data-preset]')?.dataset.preset;
  if (k) {
    s = PRESETS[k].make();
    cur = 0;
    fields();
    render();
    say(`Loaded the ${PRESETS[k].name} preset.`);
  }
});
$('#reset').addEventListener('click', () => {
  s = PRESETS.grail.make();
  cur = 0;
  fields();
  render();
  say('Reset to the holy grail layout.');
});

function say(t) {
  $('#msg').textContent = t;
}
async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    say(`Copied ${what}.`);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    say(ok ? `Copied ${what}.` : 'Copy blocked by the browser. Select the code and press Ctrl+C.');
  }
}
$('#cp-css').addEventListener('click', () => copy(out.css, 'the CSS'));
$('#cp-html').addEventListener('click', () => copy(html(s, out.areas), 'the HTML'));
width();
fields();
render();
