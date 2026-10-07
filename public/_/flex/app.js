import { $, esc, mountBar } from '/_/ui.js';
import { OPTIONS, PRESETS, defaults, item, css, html, containerDecls, itemDecls, validBasis, hint } from '/_/flex/lib.js';
await mountBar('Flex');

const MAX = 12,
  PAD = [0, 18, 6]; // ponytail: preview-only padding gives items different heights so align-items shows
let s = defaults(),
  cur = 0;
const ckeys = ['direction', 'wrap', 'justify', 'alignItems', 'alignContent'];
for (const k of ckeys) $('#c-' + k).innerHTML = OPTIONS[k].map((v) => `<option>${v}</option>`).join('');
$('#i-alignSelf').innerHTML = OPTIONS.alignSelf.map((v) => `<option>${v}</option>`).join('');
$('#presets').insertAdjacentHTML(
  'beforeend',
  Object.entries(PRESETS)
    .map(([k, p]) => `<button type="button" data-preset="${k}">${esc(p.name)}</button>`)
    .join(''),
);

const styleOf = (decls) => decls.map(([p, v]) => `${p}:${v}`).join(';');

function render() {
  const pv = $('#pv');
  pv.setAttribute('style', styleOf(containerDecls(s)));
  pv.innerHTML = s.items
    .map(
      (it, i) =>
        `<button type="button" class="fi" data-i="${i}" aria-pressed="${i === cur}" style="${esc(styleOf(itemDecls(it)))};padding-block:${8 + PAD[i % 3]}px"><b>${i + 1}</b>${esc(it.label || `Item ${i + 1}`)}</button>`,
    )
    .join('');
  for (const k of ckeys) {
    $('#c-' + k).value = s[k];
    $('#h-' + k).textContent = hint(k, s);
  }
  $('#c-gap').value = s.gap;
  $('#sel').innerHTML = s.items.map((it, i) => `<option value="${i}">Item ${i + 1}${it.label ? `: ${esc(it.label)}` : ''}</option>`).join('');
  $('#sel').value = cur;
  const it = s.items[cur];
  $('#i-label').value = it.label;
  $('#i-grow').value = it.grow;
  $('#i-shrink').value = it.shrink;
  $('#i-order').value = it.order;
  $('#i-alignSelf').value = it.alignSelf;
  if (document.activeElement !== $('#i-basis')) {
    $('#i-basis').value = it.basis;
    $('#basis-err').textContent = '';
  }
  $('#add').disabled = s.items.length >= MAX;
  $('#remove').disabled = s.items.length <= 1;
  code();
}
function code() {
  $('#o-css').textContent = css(s);
  $('#o-html').textContent = html(s);
}

// Live edits update state and the preview without rebuilding the editor (so focus and typing are not disturbed).
function patch() {
  const pv = $('#pv');
  pv.setAttribute('style', styleOf(containerDecls(s)));
  s.items.forEach((it, i) => {
    const b = pv.children[i];
    b.setAttribute('style', `${styleOf(itemDecls(it))};padding-block:${8 + PAD[i % 3]}px`);
    b.innerHTML = `<b>${i + 1}</b>${esc(it.label || `Item ${i + 1}`)}`;
  });
  for (const k of ckeys) $('#h-' + k).textContent = hint(k, s);
  $('#sel').options[cur].textContent = `Item ${cur + 1}${s.items[cur].label ? `: ${s.items[cur].label}` : ''}`;
  code();
}
const int = (v, lo, hi, d) => {
  const n = Math.round(Number(v));
  return v === '' || !Number.isFinite(n) ? d : Math.min(hi, Math.max(lo, n));
};

for (const k of ckeys)
  $('#c-' + k).addEventListener('change', (e) => {
    s[k] = e.target.value;
    patch();
  });
$('#c-gap').addEventListener('input', (e) => {
  s.gap = int(e.target.value, 0, 200, 0);
  patch();
});
$('#i-label').addEventListener('input', (e) => {
  s.items[cur].label = e.target.value;
  patch();
});
for (const [k, lo, hi, d] of [
  ['grow', 0, 99, 0],
  ['shrink', 0, 99, 1],
  ['order', -99, 99, 0],
])
  $('#i-' + k).addEventListener('input', (e) => {
    s.items[cur][k] = int(e.target.value, lo, hi, d);
    patch();
  });
$('#i-alignSelf').addEventListener('change', (e) => {
  s.items[cur].alignSelf = e.target.value;
  patch();
});
$('#i-basis').addEventListener('input', (e) => {
  const v = e.target.value.trim();
  const good = validBasis(v);
  $('#basis-err').textContent = good ? '' : 'Use auto, content, 0, or a non-negative size with a unit (px, %, em, rem, vw, vh, ch).';
  e.target.setAttribute('aria-invalid', String(!good));
  if (good) {
    s.items[cur].basis = v;
    patch();
  }
});
$('#i-basis').addEventListener('blur', (e) => {
  e.target.value = s.items[cur].basis;
  e.target.removeAttribute('aria-invalid');
  $('#basis-err').textContent = '';
});
$('#sel').addEventListener('change', (e) => {
  cur = Number(e.target.value);
  render();
});
$('#pv').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (b) {
    cur = Number(b.dataset.i);
    render();
    $('#pv').children[cur].focus();
  }
});
$('#add').addEventListener('click', () => {
  if (s.items.length < MAX) {
    s.items.push(item(''));
    cur = s.items.length - 1;
    render();
    say(`Added item ${cur + 1}.`);
  }
});
$('#remove').addEventListener('click', () => {
  if (s.items.length > 1) {
    s.items.splice(cur, 1);
    say(`Removed item ${cur + 1}.`);
    cur = Math.min(cur, s.items.length - 1);
    render();
  }
});
$('#presets').addEventListener('click', (e) => {
  const k = e.target.closest('[data-preset]')?.dataset.preset;
  if (k) {
    s = PRESETS[k].make();
    cur = 0;
    render();
    say(`Loaded the ${PRESETS[k].name} preset.`);
  }
});
$('#reset').addEventListener('click', () => {
  s = defaults();
  cur = 0;
  render();
  say('Reset to the default layout.');
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
$('#cp-css').addEventListener('click', () => copy(css(s), 'the CSS'));
$('#cp-html').addEventListener('click', () => copy(html(s), 'the HTML'));
render();
