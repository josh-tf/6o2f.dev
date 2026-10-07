import { $, esc, mountBar } from '/_/ui.js';
import { parse, humanize, toISO, toClock, totals, round } from './lib.js';
mountBar('Durations');
const EX = ['P1Y2M3DT4H5M6S', '2h30m', '90 minutes', 'a week and 3 days', '1:30:15', '1.5 days', '86400'];
$('.ex').insertAdjacentHTML('beforeend', EX.map((e) => `<button type="button" class="chip" data-ex="${esc(e)}">${esc(e)}</button>`).join(''));
const nf = (n) =>
  Math.abs(n) >= 1e15 || (n !== 0 && Math.abs(n) < 1e-6) ? n.toExponential(6) : round(n, 6).toLocaleString('en', { maximumFractionDigits: 6 });
const plainNum = (n) => String(round(n, 6));

let msgT;
async function copy(text) {
  const say = (m) => {
    $('#msg').textContent = m;
    clearTimeout(msgT);
    msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
  };
  try {
    await navigator.clipboard.writeText(text);
    say(`Copied ${text}`);
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    say(ok ? `Copied ${text}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.');
  }
}
const row = (k, v, code = true) =>
  `<tr><th scope="row">${k}</th><td>${code ? `<code>${esc(v)}</code>` : esc(v)}</td><td class="cp"><button type="button" data-c="${esc(v)}" aria-label="Copy ${k}">Copy</button></td></tr>`;

function run() {
  const r = parse($('#in').value, $('#plain').value),
    ok = !r.error && Number.isFinite(r.seconds) && Math.abs(r.seconds) < 1e15;
  $('#err').textContent = r.error || (ok ? '' : 'That duration is too large to convert.');
  $('#in').setAttribute('aria-invalid', String(!ok));
  if (!ok) {
    $('#fmt').tBodies[0].innerHTML = $('#tot').tBodies[0].innerHTML = '';
    $('#nominal').hidden = true;
    return;
  }
  const s = r.seconds,
    lg = $('#largest').value;
  $('#fmt').tBodies[0].innerHTML = [
    row('In words', humanize(s, lg), false),
    row('ISO 8601', toISO(s, 'days')),
    row('ISO (hours)', toISO(s, 'hours')),
    row('h:mm:ss', toClock(s)),
    row('Seconds', plainNum(s)),
    row('Milliseconds', plainNum(s * 1000)),
  ].join('');
  $('#nominal').hidden = !(r.nominal || ['years', 'months'].includes(lg));
  $('#tot').tBodies[0].innerHTML = totals(s)
    .reverse()
    .map(
      ([u, v]) =>
        `<tr><th scope="row">${u[0].toUpperCase() + u.slice(1)}</th><td class="n">${nf(v)}</td><td class="cp"><button type="button" data-c="${plainNum(v)}" aria-label="Copy total ${u}">Copy</button></td></tr>`,
    )
    .join('');
}
for (const id of ['#in', '#plain', '#largest']) $(id).addEventListener('input', run);
document.addEventListener('click', (e) => {
  const ex = e.target.closest('[data-ex]')?.dataset.ex;
  if (ex) {
    $('#in').value = ex;
    run();
    $('#in').focus();
    return;
  }
  const c = e.target.closest('[data-c]')?.dataset.c;
  if (c) copy(c);
});
$('#in').value = 'P1DT2H3M4.5S';
run();
