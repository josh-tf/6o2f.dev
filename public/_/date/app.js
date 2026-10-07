import { $, esc, mountBar } from '/_/ui.js';
import {
  parse,
  isoDate,
  isoDateTime,
  add,
  diff,
  isoWeek,
  isoWeekString,
  weekdayName,
  dayOfYear,
  isLeap,
  daysInMonth,
  businessDays,
  parseHolidays,
  age,
  toMs,
  fromMs,
  dayNum,
} from './lib.js';
mountBar('Dates');
$('#tzname').textContent = `(${Intl.DateTimeFormat().resolvedOptions().timeZone || 'browser zone'})`;
const utc = () => document.querySelector('input[name=tz]:checked').value === 'utc';
const now = () => fromMs(Date.now(), utc());
const nf = (n, dp = 0) => n.toLocaleString('en', { maximumFractionDigits: dp });
const plural = (n, w) => `${nf(n)} ${w}${n === 1 ? '' : 's'}`;
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const long = (f, time = true) =>
  `${weekdayName(f)}, ${f.d} ${MON[f.m - 1]} ${f.y}${time ? `, ${String(f.h).padStart(2, '0')}:${String(f.mi).padStart(2, '0')}` : ''}${time && utc() ? ' UTC' : ''}`;
const int = (id) => {
  const v = $(id).value.trim();
  return v === '' ? 0 : Number.isInteger(Number(v)) ? Number(v) : NaN;
};

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

function addCalc() {
  const f = parse($('#a-start').value),
    sign = Number(document.querySelector('input[name=op]:checked').value);
  const v = { years: int('#a-y'), months: int('#a-m'), weeks: int('#a-w'), days: int('#a-d'), hours: int('#a-h') };
  let err = !f ? 'Pick a start date and time.' : Object.values(v).some(Number.isNaN) ? 'Use whole numbers for every amount (negative is fine).' : '';
  let r;
  if (!err) {
    r = add(f, Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sign * x])), utc());
    if (!Number.isFinite(r.y) || Math.abs(r.y) > 275000) err = 'That lands outside the dates a browser can handle.';
  }
  $('#a-err').textContent = err;
  $('#a-out').innerHTML = err
    ? ''
    : `<time datetime="${isoDateTime(r)}">${esc(long(r))}</time><span class="muted">${isoDateTime(r)} · ${isoWeekString(r)}</span>`;
  $('#a-copy').disabled = !!err;
  $('#a-copy').dataset.c = err ? '' : isoDateTime(r);
}

function diffCalc() {
  const a = parse($('#d-from').value),
    b = parse($('#d-to').value),
    z = utc();
  $('#d-err').textContent = a && b ? '' : 'Pick both dates.';
  if (!a || !b) {
    $('#d-out').textContent = $('#b-out').textContent = '';
    $('#d-tot').tBodies[0].innerHTML = '';
    return;
  }
  const d = diff(a, b),
    parts = [
      ['year', d.years],
      ['month', d.months],
      ['day', d.days],
      ['hour', d.hours],
      ['minute', d.minutes],
    ]
      .filter(([, n]) => n)
      .map(([w, n]) => plural(n, w));
  $('#d-out').textContent = d.sign === 0 ? 'Same moment' : `${parts.join(', ')}${d.sign < 0 ? ' earlier' : ''}`;
  const ms = toMs(b, z) - toMs(a, z),
    wall = toMs(b, true) - toMs(a, true);
  const rows = [
    ['Days', ms / 864e5, 2],
    ['Weeks', ms / 6048e5, 2],
    ['Hours', ms / 36e5, 2],
    ['Minutes', ms / 6e4, 0],
    ['Seconds', ms / 1e3, 0],
  ];
  $('#d-tot').tBodies[0].innerHTML =
    rows.map(([k, n, dp]) => `<tr><th scope="row">${k}</th><td class="num-c">${nf(n, dp)}</td></tr>`).join('') +
    (ms !== wall ? `<tr><td colspan="2" class="muted">Includes a daylight-saving change of ${nf((ms - wall) / 36e5, 2)} h.</td></tr>` : '');
  const h = parseHolidays($('#hol').value),
    bd = businessDays(a, b, h.set);
  $('#hol-err').textContent = h.bad.length ? `Not real dates, ignored: ${h.bad.join(', ')}` : '';
  $('#b-out').textContent =
    `${plural(bd.days, 'business day')} (Monday to Friday, counting the start date but not the end)${bd.holidays ? `, ${plural(bd.holidays, 'holiday')} excluded` : ''}.`;
}

function infoCalc() {
  const f = parse($('#i-date').value),
    body = $('#i-tab').tBodies[0];
  if (!f) {
    body.innerHTML = '<tr><td class="muted">Pick a date.</td></tr>';
    return;
  }
  const w = isoWeek(f),
    rel = dayNum(f) - dayNum(now()),
    q = Math.ceil(f.m / 3);
  const rows = [
    ['Weekday', weekdayName(f)],
    ['ISO week', `Week ${w.week} of ${w.year} (${isoWeekString(f)})`],
    ['Day of year', `${dayOfYear(f)} of ${isLeap(f.y) ? 366 : 365}`],
    ['Quarter', `Q${q} ${f.y}`],
    ['Month', `${MON[f.m - 1]} has ${daysInMonth(f.y, f.m)} days`],
    ['Leap year', isLeap(f.y) ? `Yes, ${f.y} is a leap year` : `No, ${f.y} is not a leap year`],
    ['From today', rel === 0 ? 'Today' : rel > 0 ? `In ${plural(rel, 'day')}` : `${plural(-rel, 'day')} ago`],
    ['Unix time (midnight)', String(toMs({ ...f, h: 0, mi: 0 }, utc()) / 1000)],
  ];
  body.innerHTML = rows
    .map(
      ([k, v]) =>
        `<tr><th scope="row">${k}</th><td>${esc(v)}</td><td class="cp"><button type="button" data-c="${esc(v)}" aria-label="Copy ${k}">Copy</button></td></tr>`,
    )
    .join('');
}

function ageCalc() {
  const b = parse($('#g-birth').value),
    on = parse($('#g-on').value);
  const r = b && on ? age(b, on) : null;
  $('#g-err').textContent = !b || !on ? 'Pick both dates.' : r ? '' : 'The birth date is after the date to measure on.';
  $('#g-out').textContent = r ? `${plural(r.years, 'year')}, ${plural(r.months, 'month')}, ${plural(r.days, 'day')}` : '';
  $('#g-more').textContent = r
    ? `${plural(r.totalDays, 'day')} in total. ${r.nextIn === 0 ? `Birthday today: ${r.nextAge}!` : `Turns ${r.nextAge} in ${plural(r.nextIn, 'day')}, on a ${r.nextWeekday}.`}`
    : '';
}

const all = () => {
  addCalc();
  diffCalc();
  infoCalc();
  ageCalc();
};
const on = (ids, fn) => ids.forEach((id) => $(id).addEventListener('input', fn));
on(['#a-start', '#a-y', '#a-m', '#a-w', '#a-d', '#a-h'], addCalc);
document.querySelectorAll('input[name=op]').forEach((r) => r.addEventListener('change', addCalc));
on(['#d-from', '#d-to', '#hol'], diffCalc);
on(['#i-date'], infoCalc);
on(['#g-birth', '#g-on'], ageCalc);
document.querySelectorAll('input[name=tz]').forEach((r) => r.addEventListener('change', all));
$('#a-now').addEventListener('click', () => {
  $('#a-start').value = isoDateTime(now());
  addCalc();
});
$('#d-swap').addEventListener('click', () => {
  [$('#d-from').value, $('#d-to').value] = [$('#d-to').value, $('#d-from').value];
  diffCalc();
});
$('#i-today').addEventListener('click', () => {
  $('#i-date').value = isoDate(now());
  infoCalc();
});
$('#a-copy').addEventListener('click', (e) => e.currentTarget.dataset.c && copy(e.currentTarget.dataset.c));
$('#i-tab').addEventListener('click', (e) => {
  const c = e.target.closest('[data-c]')?.dataset.c;
  if (c) copy(c);
});

// Example state: today, a month on; today to New Year; a holiday list for the period.
const t = now(),
  ny = { y: t.y + 1, m: 1, d: 1, h: 0, mi: 0 };
$('#a-start').value = isoDateTime({ ...t, h: 9, mi: 0 });
$('#d-from').value = isoDateTime({ ...t, h: 0, mi: 0 });
$('#d-to').value = isoDateTime(ny);
$('#hol').value = `${t.y}-12-25 Christmas Day\n${t.y}-12-26 Boxing Day`;
$('#i-date').value = isoDate(t);
$('#g-birth').value = isoDate({ y: t.y - 30, m: 2, d: 29 > daysInMonth(t.y - 30, 2) ? 28 : 29 });
$('#g-on').value = isoDate(t);
all();
