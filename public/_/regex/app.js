import { $, mountBar } from '/_/ui.js';
import { segments } from './lib.js';
mountBar('Regex tester');
$('#pat').value = '(?<user>[\\w.+-]+)@(?<host>[\\w-]+(?:\\.[\\w-]+)+)';
$('#txt').value = 'Contact ada@example.com or grace.hopper@navy.mil.\nNot an address: nobody@localhost\nbilling+2024@my-company.co.uk';
$('#rep').value = '$<user> at $<host>';
const flagBoxes = [...document.querySelectorAll('.flags input')];
let worker,
  pending = null,
  timer;
const spawn = () => {
  worker = new Worker('/_/regex/worker.js', { type: 'module' });
  worker.onmessage = ({ data }) => {
    if (pending?.id === data.id) {
      clearTimeout(pending.t);
      const p = pending;
      pending = null;
      p.done(data);
    }
  };
};
spawn();
const call = (job) =>
  new Promise((done) => {
    if (pending) {
      clearTimeout(pending.t);
      worker.terminate();
      spawn();
    } // superseded
    const id = (call.n = (call.n || 0) + 1);
    pending = {
      id,
      done,
      t: setTimeout(() => {
        pending = null;
        worker.terminate();
        spawn();
        done({ id, error: 'too slow' });
      }, 1000),
    };
    worker.postMessage({ id, ...job });
  });
const st = (msg, err) => {
  $('#status').textContent = err ? '' : msg;
  $('#err').textContent = err ? msg : '';
};
function table(head, rows, cap) {
  const t = $('#groups');
  t.tHead.replaceChildren();
  t.tBodies[0].replaceChildren();
  $('#gcap').textContent = cap;
  if (!head) return;
  const add = (sec, cells, tag) => {
    const tr = sec.insertRow();
    for (const v of cells) {
      const c = document.createElement(tag);
      c.textContent = v ?? '(unset)';
      if (tag === 'th') c.scope = 'col';
      tr.append(c);
    }
  };
  add(t.tHead, head, 'th');
  rows.forEach((r) => add(t.tBodies[0], r, 'td'));
  if (!rows.length) Object.assign(t.tBodies[0].insertRow().insertCell(), { colSpan: head.length, className: 'muted', textContent: 'No matches.' });
}
async function run() {
  const pattern = $('#pat').value,
    text = $('#txt').value,
    rep = $('#rep').value;
  const flags = flagBoxes
    .filter((b) => b.checked)
    .map((b) => b.value)
    .join('');
  if (!pattern) {
    st('Enter a pattern.');
    $('#hl').textContent = text;
    table(null, [], '');
    $('#repout').textContent = '';
    return;
  }
  const r = await call({ pattern, flags, text, repl: rep || null });
  if (r.error) {
    $('#hl').textContent = text;
    table(null, [], '');
    $('#repout').textContent = '';
    return st(
      r.error === 'too slow'
        ? 'Too slow: this pattern took over 1 second on this text, so it was stopped. It probably backtracks catastrophically (nested quantifiers like (a+)+).'
        : r.error,
      true,
    );
  }
  st(`${r.matches.length}${r.truncated ? '+' : ''} match${r.matches.length === 1 ? '' : 'es'}${r.truncated ? ' (stopped at 1000)' : ''}.`);
  const hl = $('#hl');
  hl.replaceChildren();
  let k = 0;
  for (const s of segments(text, r.matches)) {
    if (!s.hit) {
      hl.append(s.text);
      continue;
    }
    const m = document.createElement('mark');
    m.textContent = s.text;
    if (k++ % 2) m.className = 'b';
    hl.append(m);
  }
  const n = Math.max(0, ...r.matches.map((m) => m.groups.length));
  const names = [...new Set(r.matches.flatMap((m) => Object.keys(m.named || {})))];
  table(
    ['#', 'Index', 'Match', ...Array.from({ length: n }, (_, i) => `Group ${i + 1}`), ...names.map((k) => `<${k}>`)],
    r.matches.slice(0, 100).map((m, i) => [i + 1, m.index, m.text, ...Array.from({ length: n }, (_, j) => m.groups[j]), ...names.map((k) => m.named?.[k])]),
    r.matches.length > 100 ? `First 100 of ${r.matches.length} matches` : `${r.matches.length} matches with their capture groups`,
  );
  $('#repout').textContent = rep ? r.replaced : '';
  $('#repout').classList.toggle('muted', !rep);
  if (!rep) $('#repout').textContent = 'Type a replacement above to preview the result.';
}
const later = () => {
  clearTimeout(timer);
  timer = setTimeout(run, 150);
};
for (const el of ['#pat', '#txt', '#rep']) $(el).addEventListener('input', later);
flagBoxes.forEach((b) => b.addEventListener('change', later));
run();
