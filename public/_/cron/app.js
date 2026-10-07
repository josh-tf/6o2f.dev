import { $, mountBar } from '/_/ui.js';
import { parse, nextRuns, explain, until } from './lib.js';
mountBar('Cron');
const PRESETS = [
  ['Every minute', '* * * * *'],
  ['Every 15 min', '*/15 * * * *'],
  ['Hourly', '@hourly'],
  ['Daily 09:00', '0 9 * * *'],
  ['Weekdays 09:30', '30 9 * * MON-FRI'],
  ['Weekly', '@weekly'],
  ['Monthly', '@monthly'],
  ['Yearly', '@yearly'],
];
const expr = $('#expr'),
  tz = () => document.querySelector('[name=tz]:checked').value;
expr.value = '30 9 * * MON-FRI';
$('#tzname').textContent = `Local (${Intl.DateTimeFormat().resolvedOptions().timeZone})`;
for (const [label, e] of PRESETS) {
  const b = Object.assign(document.createElement('button'), { textContent: label, type: 'button', title: e });
  b.addEventListener('click', () => {
    expr.value = e;
    run();
  });
  $('#presets').append(b);
}
function run() {
  const out = $('#explain'),
    list = $('#list');
  list.replaceChildren();
  $('#err').textContent = '';
  expr.removeAttribute('aria-invalid');
  if (!expr.value.trim()) {
    out.textContent = 'Type a cron expression or pick a preset.';
    out.classList.add('muted');
    return;
  }
  out.classList.remove('muted');
  try {
    const c = parse(expr.value);
    out.textContent = explain(c) + '.';
    const utc = tz() === 'utc';
    const runs = nextRuns(c, new Date(), 10, utc);
    const f = new Intl.DateTimeFormat(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: utc ? 'UTC' : undefined,
      timeZoneName: 'short',
    });
    const now = new Date();
    runs.forEach((d, i) => {
      const r = list.insertRow(),
        t = document.createElement('time');
      r.insertCell().textContent = i + 1;
      t.dateTime = d.toISOString();
      t.textContent = f.format(d);
      r.insertCell().append(t);
      r.insertCell().textContent = until(d, now);
    });
    if (!runs.length) Object.assign(list.insertRow().insertCell(), { colSpan: 3, textContent: 'Never runs in the next 9 years (for example, February 30).' });
  } catch (e) {
    out.textContent = '';
    $('#err').textContent = e.message;
    expr.setAttribute('aria-invalid', 'true');
  }
}
expr.addEventListener('input', run);
document.querySelectorAll('[name=tz]').forEach((r) => r.addEventListener('change', run));
run();
setInterval(run, 60e3); // keep "next runs" and "from now" current while the page stays open
