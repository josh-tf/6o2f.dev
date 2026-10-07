import { $, mountBar } from '/_/ui.js';
import { calc, csv, money, span, FREQ } from '/_/loan/lib.js';
await mountBar('Loan');
const PAGE = 60,
  ids = ['principal', 'rate', 'start', 'years', 'months', 'freq', 'extra', 'io', 'balloon'];
const el = Object.fromEntries(ids.map((i) => [i, $('#' + i)]));
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
let res = null,
  page = 0;

function defaults() {
  Object.assign(el.principal, { value: 300000 });
  el.rate.value = 6;
  el.years.value = 30;
  el.months.value = 0;
  el.freq.value = 'monthly';
  el.extra.value = 0;
  el.io.value = 0;
  el.balloon.value = 0;
  el.start.value = today();
}
async function copy(text, what) {
  const msg = $('#msg');
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = `Copied ${what}.`;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    msg.textContent = ok ? `Copied ${what}.` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  }
}

function chart(rows, principal) {
  const W = 640,
    H = 260,
    L = 64,
    R = 12,
    T = 12,
    B = 28,
    n = rows.length;
  const max = Math.max(principal, rows[n - 1].cumInterest, 1);
  const x = (i) => L + ((W - L - R) * i) / Math.max(n, 1),
    y = (v) => T + (H - T - B) * (1 - v / max);
  const pts = (f, first) => [[0, first], ...rows.map((r, i) => [i + 1, f(r)])];
  const path = (a) => a.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join('');
  const short = (c) => {
    const d = c / 100;
    return d >= 1e6 ? `$${+(d / 1e6).toFixed(2)}M` : d >= 1e3 ? `$${+(d / 1e3).toFixed(d >= 1e5 ? 0 : 1)}k` : `$${Math.round(d)}`;
  };
  let g = '';
  for (let k = 0; k <= 4; k++) {
    const v = (max * k) / 4;
    g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${short(v)}</text>`;
  }
  const ppy = FREQ[el.freq.value].ppy,
    yrs = n / ppy,
    step = yrs > 20 ? 5 : yrs > 8 ? 2 : 1;
  for (let t = 0; t <= yrs + 1e-9; t += step)
    g += `<text x="${x(t * ppy)}" y="${H - 8}" text-anchor="${t === 0 ? 'start' : x(t * ppy) > W - R - 20 ? 'end' : 'middle'}">${t === 0 ? 'Start' : `Yr ${t}`}</text>`;
  $('#chart').innerHTML = g + `<path class="bal" d="${path(pts((r) => r.balance, principal))}"/><path class="int" d="${path(pts((r) => r.cumInterest, 0))}"/>`;
  $('#chart').setAttribute(
    'aria-label',
    `Chart over ${span(n, el.freq.value)}: balance falls from ${money(principal)} to $0 while interest paid rises to ${money(rows[n - 1].cumInterest)}.`,
  );
}

function table() {
  const rows = res.rows,
    pages = Math.ceil(rows.length / PAGE);
  page = Math.min(page, pages - 1);
  $('#sched tbody').innerHTML = rows
    .slice(page * PAGE, page * PAGE + PAGE)
    .map(
      (r) =>
        `<tr${r.n <= res.ioPeriods ? ' class="io"' : ''}><td>${r.n}</td><td><time datetime="${r.date}">${r.date}</time></td><td class="r">${money(r.payment + r.extra)}</td><td class="r">${money(r.interest)}</td><td class="r">${money(r.principal)}</td><td class="r">${money(r.balance)}</td></tr>`,
    )
    .join('');
  $('#pageinfo').textContent = `Payments ${page * PAGE + 1} to ${Math.min(rows.length, page * PAGE + PAGE)} of ${rows.length}`;
  $('#prev').disabled = page === 0;
  $('#next').disabled = page >= pages - 1;
  $('#prev').parentElement.hidden = pages < 2;
}

function update() {
  const f = el.freq.value;
  res = calc({
    principal: el.principal.value,
    rate: el.rate.value,
    years: el.years.value,
    months: el.months.value,
    freq: f,
    extra: el.extra.value,
    ioMonths: el.io.value,
    balloon: el.balloon.value,
    start: el.start.value || today(),
  });
  $('#err').textContent = res.error || '';
  $('#out').hidden = $('#note').hidden = $('#sched').closest('section').hidden = $('#chart').closest('section').hidden = !!res.error;
  if (res.error) {
    res = null;
    return;
  }
  $('#l-pay').textContent = `${FREQ[f].label} repayment`;
  $('#o-pay').textContent = money(res.ioPeriods ? res.ioPayment : res.payment);
  $('#o-int').textContent = money(res.totalInterest);
  $('#o-tot').textContent = money(res.totalPaid);
  $('#o-end').innerHTML =
    `<time datetime="${res.payoffDate}">${new Date(res.payoffDate + 'T00:00Z').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}</time>`;
  const n = [];
  if (res.ioPeriods) n.push(`Interest-only for the first ${res.ioPeriods} repayments, then ${money(res.payment)} each.`);
  if (res.balloon) n.push(`The last repayment is ${money(res.finalPayment)} because it includes the ${money(res.balloon)} balloon.`);
  if (res.savedInterest > 0)
    n.push(`Extra repayments save ${money(res.savedInterest)} in interest${res.savedPeriods > 0 ? ` and finish ${span(res.savedPeriods, f)} sooner` : ''}.`);
  n.push(
    `${res.scheduled} repayment${res.scheduled === 1 ? '' : 's'} over ${span(res.scheduled, f)}. Interest is charged each period on the balance at the rate divided by ${FREQ[f].ppy}.`,
  );
  $('#note').textContent = n.join(' ');
  chart(res.rows, res.principal);
  table();
}

$('#f').addEventListener('input', () => {
  page = 0;
  update();
});
$('#f').addEventListener('change', () => {
  page = 0;
  update();
});
$('#f').addEventListener('submit', (e) => e.preventDefault());
$('#reset').addEventListener('click', () => {
  defaults();
  page = 0;
  update();
});
$('#prev').addEventListener('click', () => {
  page--;
  table();
});
$('#next').addEventListener('click', () => {
  page++;
  table();
});
$('#copycsv').addEventListener('click', () => res && copy(csv(res.rows), `${res.rows.length} rows as CSV`));
defaults();
update();
