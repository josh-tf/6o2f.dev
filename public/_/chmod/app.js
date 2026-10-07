import { $, esc, mountBar } from '/_/ui.js';
import { parseOctal, toOctal, toLs, parseLs, toClauses, applySymbolic, command, explain, notes, shq, PRESETS, parseUmask, umaskResult, UMASKS } from './lib.js';
mountBar('chmod');
let mode = 0o755,
  ftype = '-',
  symBase = mode,
  umask = 0o022;
const boxes = [...document.querySelectorAll('input[data-bit]')];
const msg = $('#msg');
let msgT;
async function copy(text, what) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(t);
    t.select();
    try {
      ok = document.execCommand('copy');
    } catch {}
    t.remove();
  }
  msg.textContent = ok ? `Copied ${what}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  clearTimeout(msgT);
  msgT = setTimeout(() => (msg.textContent = ''), 2500);
}
const err = (id, t = '') => ($(`#e-${id}`).textContent = t);

/** Redraw everything except the field the user is typing in (`skip`). */
function render(skip = '') {
  for (const b of boxes) b.checked = !!(mode & +b.dataset.bit);
  for (const s of [6, 3, 0]) $(`#d${s}`).textContent = (mode >> s) & 7;
  if (skip !== 'oct') {
    $('#oct').value = toOctal(mode);
    err('oct');
  }
  if (skip !== 'sym') {
    $('#sym').value = toClauses(mode);
    err('sym');
  }
  if (skip !== 'ls') {
    $('#ls').value = ftype + toLs(mode);
    err('ls');
  }
  $('#cmd').value = $('#cmd').textContent = command(mode, { file: $('#file').value, recursive: $('#rec').checked });
  $('#explain').textContent = explain(mode);
  $('#notes').innerHTML = notes(mode)
    .map((n) => `<li class="${n.level}">${n.level === 'warn' ? '<b>Careful: </b>' : ''}${esc(n.text)}</li>`)
    .join('');
  document.querySelectorAll('#presets li').forEach((li) => li.classList.toggle('on', +li.dataset.mode === mode));
}
const set = (m, skip) => {
  mode = m & 0o7777;
  render(skip);
};

for (const b of boxes) b.addEventListener('change', () => set(boxes.reduce((a, x) => a | (x.checked ? +x.dataset.bit : 0), 0)));
$('#oct').addEventListener('input', (e) => {
  const m = parseOctal(e.target.value);
  if (m === null) return err('oct', 'Use 3 or 4 octal digits (0-7), for example 755 or 2775.');
  set(m, 'oct');
});
$('#sym').addEventListener('focus', () => (symBase = mode));
$('#sym').addEventListener('input', (e) => {
  const r = applySymbolic(e.target.value, symBase);
  if (r.error) return err('sym', r.error);
  set(r.mode, 'sym');
});
$('#ls').addEventListener('input', (e) => {
  const r = parseLs(e.target.value);
  if (!r)
    return err('ls', 'Use 9 characters like rwxr-xr-x, optionally with a leading type such as - or d. s goes in the owner/group execute slot, t in the last.');
  ftype = r.type;
  set(r.mode, 'ls');
});
for (const id of ['oct', 'sym', 'ls']) $(`#${id}`).addEventListener('blur', () => render());
$('#file').addEventListener('input', () => render('file'));
$('#rec').addEventListener('change', () => render());
$('#cp-cmd').addEventListener('click', () => copy($('#cmd').textContent, 'command'));
$('#cp-sym').addEventListener('click', () =>
  copy(`chmod ${$('#rec').checked ? '-R ' : ''}${toClauses(mode)} ${shq($('#file').value || 'file')}`, 'symbolic command'),
);

$('#presets').innerHTML = PRESETS.map(
  (p) =>
    `<li data-mode="${p.mode}"><div class="hd"><button type="button" data-m="${p.mode}" aria-label="${toOctal(p.mode).replace(/^0/, '')}: use this mode">${toOctal(p.mode).replace(/^0/, '')}</button><span class="mono muted">${toLs(p.mode)}</span></div><p class="use">${esc(p.use)}</p><p>${esc(p.what)}</p><p class="sec"><b>Security: </b>${esc(p.sec)}</p></li>`,
).join('');
$('#presets').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-m]');
  if (b) set(+b.dataset.m);
});

function drawUmask(skip) {
  const r = umaskResult(umask);
  $('#umout').innerHTML = [
    ['File', r.file],
    ['Directory', r.dir],
  ]
    .map(([k, m]) => `<tr><th scope="row">${k}</th><td class="mono">${toOctal(m).replace(/^0/, '')}</td><td class="mono">${toLs(m)}</td></tr>`)
    .join('');
  const hit = UMASKS.find((u) => u.v === umask);
  $('#umwhat').textContent = hit ? hit.what : '';
  document.querySelectorAll('#umpre button').forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.u === umask)));
  if (skip !== 'um') {
    $('#um').value = '0' + umask.toString(8).padStart(3, '0');
    err('um');
  }
}
$('#umpre').innerHTML = UMASKS.map((u) => `<button type="button" data-u="${u.v}" aria-pressed="false">0${u.v.toString(8).padStart(3, '0')}</button>`).join('');
$('#umpre').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-u]');
  if (b) {
    umask = +b.dataset.u;
    drawUmask();
  }
});
$('#um').addEventListener('input', (e) => {
  const u = parseUmask(e.target.value);
  if (u === null) return err('um', 'Use 3 or 4 octal digits (0-7), for example 022.');
  umask = u;
  drawUmask('um');
});
$('#um').addEventListener('blur', () => drawUmask());

const h = parseOctal(location.hash.slice(1));
if (h !== null) mode = h;
render();
drawUmask();
