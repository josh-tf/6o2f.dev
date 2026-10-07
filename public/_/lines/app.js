import { $, esc, mountBar } from '/_/ui.js';
import { OPS, runPipeline, toLines } from './lib.js';
mountBar('Lines');

// Controls per operation: [key, kind, label, options]
const F = {
  sort: [
    [
      'by',
      'select',
      'Order',
      [
        ['natural', 'Natural (file2 before file10)'],
        ['alpha', 'Alphabetical'],
        ['numeric', 'Numeric'],
        ['length', 'Length'],
      ],
    ],
    ['ci', 'check', 'Ignore case'],
    ['desc', 'check', 'Descending'],
  ],
  shuffle: [['seed', 'text', 'Seed (optional)']],
  dedupe: [
    ['ci', 'check', 'Ignore case'],
    ['trim', 'check', 'Ignore outer spaces'],
    ['counts', 'check', 'Prefix counts'],
  ],
  trim: [
    [
      'side',
      'select',
      'Trim',
      [
        ['both', 'Both ends'],
        ['start', 'Start only'],
        ['end', 'End only'],
      ],
    ],
  ],
  noempty: [['blank', 'check', 'Whitespace-only counts as empty']],
  affix: [
    ['prefix', 'text', 'Prefix'],
    ['suffix', 'text', 'Suffix'],
  ],
  number: [
    ['start', 'number', 'Start at'],
    ['sep', 'text', 'Separator'],
    ['pad', 'check', 'Zero-pad'],
  ],
  join: [['delim', 'text', 'Delimiter (\\t, \\n ok)']],
  split: [
    ['delim', 'text', 'Delimiter'],
    ['regex', 'check', 'Regex'],
    ['trim', 'check', 'Trim parts'],
  ],
  filter: [
    [
      'invert',
      'select',
      'Mode',
      [
        ['false', 'Keep lines'],
        ['true', 'Drop lines'],
      ],
    ],
    ['query', 'text', 'Containing', null, 'wide'],
    ['regex', 'check', 'Regex'],
    ['ci', 'check', 'Ignore case'],
  ],
  sample: [
    ['n', 'number', 'How many'],
    ['seed', 'text', 'Seed (optional)'],
  ],
  head: [
    [
      'from',
      'select',
      'Take',
      [
        ['start', 'First'],
        ['end', 'Last'],
      ],
    ],
    ['n', 'number', 'How many'],
  ],
  reverse: [],
};

let uid = 0;
const step = (op, p = {}) => ({ id: ++uid, op, p: { ...OPS[op].defaults, ...p }, off: false });
let steps = [step('trim'), step('noempty'), step('dedupe', { ci: true, counts: false }), step('sort', { by: 'natural' })];

let msgT;
async function copy(text, what) {
  const msg = $('#msg');
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = `Copied ${what}`;
  } catch {
    $('#out').select();
    const ok = document.execCommand?.('copy');
    msg.textContent = ok ? `Copied ${what}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  }
  clearTimeout(msgT);
  msgT = setTimeout(() => (msg.textContent = ''), 2500);
}

function field(s, [key, kind, label, opts, cls]) {
  const id = `s${s.id}-${key}`,
    v = s.p[key];
  if (kind === 'check') return `<label class="chk" for="${id}"><input type="checkbox" id="${id}" data-k="${key}"${v ? ' checked' : ''}> ${esc(label)}</label>`;
  let ctl;
  if (kind === 'select')
    ctl = `<select id="${id}" data-k="${key}">${opts.map(([o, t]) => `<option value="${o}"${String(v) === o ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
  else if (kind === 'number')
    ctl = `<input type="number" id="${id}" data-k="${key}" value="${esc(v)}" step="1" ${key === 'start' ? '' : 'min="0"'} inputmode="numeric">`;
  else ctl = `<input type="text" id="${id}" data-k="${key}" value="${esc(v)}" autocomplete="off" spellcheck="false" autocapitalize="off">`;
  return `<div class="f ${cls || ''}"><label for="${id}">${esc(label)}</label>${ctl}</div>`;
}

function render(focusSel) {
  $('#steps').innerHTML = steps
    .map(
      (s, i) => `<li><fieldset data-id="${s.id}" class="${s.off ? 'off' : ''}"><legend class="vh">Step ${i + 1}: ${esc(OPS[s.op].label)}</legend>
<div class="head"><span class="name" aria-hidden="true">${esc(OPS[s.op].label)}</span><span class="cnt" data-cnt></span>
<label class="chk" for="s${s.id}-on" title="Turn this step on or off"><input type="checkbox" id="s${s.id}-on" data-on${s.off ? '' : ' checked'}> On</label>
<button type="button" data-mv="-1" aria-label="Move step ${i + 1} up"${i ? '' : ' disabled'}>↑</button><button type="button" data-mv="1" aria-label="Move step ${i + 1} down"${i < steps.length - 1 ? '' : ' disabled'}>↓</button><button type="button" data-rm aria-label="Remove step ${i + 1}">✕</button></div>
${F[s.op].length ? `<div class="fields">${F[s.op].map((f) => field(s, f)).join('')}</div>` : ''}<p class="msg" data-msg hidden></p></fieldset></li>`,
    )
    .join('');
  $('#empty').hidden = steps.length > 0;
  if (focusSel) queueMicrotask(() => ($(focusSel) || $('#add')).focus()); // after ui.js wraps number inputs (re-parenting drops focus)
  schedule(0);
}

let timer,
  lastIn = null,
  inLines = [];
function schedule(ms) {
  clearTimeout(timer);
  timer = setTimeout(run, ms ?? (inLines.length > 20000 ? 300 : 120));
}
function run() {
  const text = $('#in').value;
  if (text !== lastIn) {
    inLines = toLines(text);
    lastIn = text;
  }
  const t0 = performance.now();
  const r = runPipeline(inLines, steps);
  const ms = performance.now() - t0;
  $('#out').value = r.lines.join('\n');
  const lis = [...document.querySelectorAll('#steps fieldset')];
  lis.forEach((fs, i) => {
    const c = r.counts[i],
      bad = r.error?.step === i,
      msg = fs.querySelector('[data-msg]');
    fs.querySelector('[data-cnt]').textContent = c === undefined ? (bad ? 'error' : '') : `→ ${c.toLocaleString()} line${c === 1 ? '' : 's'}`;
    fs.classList.toggle('bad', bad);
    msg.hidden = !bad;
    msg.textContent = bad ? r.error.message : '';
  });
  $('#err').textContent = r.error ? `Step ${r.error.step + 1} (${OPS[steps[r.error.step].op].label}): ${r.error.message} Later steps were skipped.` : '';
  const chars = $('#out').value.length;
  $('#stats').textContent =
    text === ''
      ? 'Paste or type lines, or load a text file.'
      : `${inLines.length.toLocaleString()} lines in → ${r.lines.length.toLocaleString()} out (${chars.toLocaleString()} characters, ${ms < 1 ? '<1' : Math.round(ms)} ms)`;
}

$('#steps').addEventListener('input', (e) => {
  const fs = e.target.closest('fieldset'),
    s = steps.find((x) => x.id === +fs.dataset.id);
  if (e.target.matches('[data-on]')) {
    s.off = !e.target.checked;
    fs.classList.toggle('off', s.off);
  } else {
    const k = e.target.dataset.k;
    s.p[k] = e.target.type === 'checkbox' ? e.target.checked : k === 'invert' ? e.target.value === 'true' : e.target.value;
  }
  schedule();
});
$('#steps').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const i = steps.findIndex((x) => x.id === +b.closest('fieldset').dataset.id);
  if (b.dataset.mv) {
    const j = i + +b.dataset.mv;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    const id = steps[j].id;
    render();
    ($(`fieldset[data-id="${id}"] [data-mv="${b.dataset.mv}"]:not(:disabled)`) || $(`fieldset[data-id="${id}"] [data-mv]:not(:disabled)`)).focus();
    $('#msg').textContent = `Moved to step ${j + 1}`;
  } else if (b.hasAttribute('data-rm')) {
    steps.splice(i, 1);
    const next = steps[Math.min(i, steps.length - 1)];
    render(next ? `fieldset[data-id="${next.id}"] [data-rm]` : '#addop');
    $('#msg').textContent = 'Step removed';
  }
});
$('#addop').innerHTML = Object.entries(OPS)
  .map(([k, o]) => `<option value="${k}">${esc(o.label)}</option>`)
  .join('');
$('#add').addEventListener('click', () => {
  const s = step($('#addop').value);
  steps.push(s);
  render(`fieldset[data-id="${s.id}"] ${F[s.op].length ? '[data-k]' : '[data-rm]'}`); // first setting of the new step
  $('#msg').textContent = `Added step ${steps.length}: ${OPS[s.op].label}`;
});
$('#in').addEventListener('input', () => schedule());
$('#copy').addEventListener('click', () => copy($('#out').value, `${toLines($('#out').value).length.toLocaleString()} lines`));
$('#use').addEventListener('click', () => {
  $('#in').value = $('#out').value;
  schedule(0);
  $('#in').focus();
});
$('#clear').addEventListener('click', () => {
  $('#in').value = '';
  schedule(0);
  $('#in').focus();
});
$('#file').addEventListener('change', async () => {
  const f = $('#file').files[0];
  if (!f) return;
  if (f.size > 50 * 1024 * 1024) {
    $('#err').textContent = `${f.name} is ${(f.size / 1048576).toFixed(0)} MB; the limit is 50 MB.`;
    return;
  }
  $('#in').value = await f.text();
  schedule(0);
});

$('#in').value = [
  '  report-10.pdf',
  'report-2.pdf',
  'Report-2.pdf',
  '',
  'notes.txt   ',
  'report-1.pdf',
  'image-100.png',
  'image-9.png',
  '   ',
  'notes.txt',
  'archive.zip',
  'report-10.pdf',
  'image-10.png',
].join('\n');
render();
