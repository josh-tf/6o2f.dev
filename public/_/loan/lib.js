// Loan maths in integer cents. Pure functions, no DOM.
export const FREQ = {
  monthly: { ppy: 12, label: 'Monthly', noun: 'month' },
  fortnightly: { ppy: 26, label: 'Fortnightly', noun: 'fortnight' },
  weekly: { ppy: 52, label: 'Weekly', noun: 'week' },
};
export const MAX_PERIODS = 5200;

export const toCents = (dollars) => Math.round(Number(dollars) * 100 + 1e-9 * Math.sign(dollars));
export const money = (cents) => {
  const neg = cents < 0,
    a = Math.abs(cents),
    d = Math.floor(a / 100),
    c = a % 100;
  return `${neg ? '-' : ''}$${String(d).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${String(c).padStart(2, '0')}`;
};
const plain = (cents) => `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, '0')}`;

/** Date of payment number i (1-based). Monthly keeps the day of month, clamped to the month end. */
export function addPeriods(startISO, freq, i) {
  const [y, m, d] = startISO.split('-').map(Number);
  if (freq === 'monthly') {
    const t = m - 1 + i,
      yy = y + Math.floor(t / 12),
      mm = ((t % 12) + 12) % 12;
    const last = new Date(Date.UTC(yy, mm + 1, 0)).getUTCDate();
    return new Date(Date.UTC(yy, mm, Math.min(d, last))).toISOString().slice(0, 10);
  }
  return new Date(Date.UTC(y, m - 1, d + i * (freq === 'weekly' ? 7 : 14))).toISOString().slice(0, 10);
}

/** Level payment (cents, rounded) for `n` periods at per-period rate r that leaves `balloon` owing. */
export function level(principal, r, n, balloon = 0) {
  if (n <= 0) return principal;
  if (r === 0) return Math.round((principal - balloon) / n);
  const g = (1 + r) ** n;
  return Math.round(((principal - balloon / g) * r) / (1 - 1 / g));
}

function run(p, r, n, io, balloon, extra, freq, start) {
  const pay = level(p, r, n - io, balloon),
    rows = [];
  let bal = p,
    cum = 0,
    paid = 0;
  for (let i = 1; i <= n && bal > 0; i++) {
    const interest = Math.round(bal * r);
    const last = i === n;
    let regular = i <= io ? interest : pay,
      ex = i <= io ? 0 : extra;
    let principal = regular - interest + ex;
    if (last || principal >= bal) {
      // final payment clears whatever is left (including the balloon)
      principal = bal;
      ex = Math.max(0, Math.min(ex, principal));
      regular = interest + principal - ex;
    }
    bal -= principal;
    cum += interest;
    paid += regular + ex;
    rows.push({ n: i, date: addPeriods(start, freq, i), payment: regular, extra: ex, interest, principal, balance: bal, cumInterest: cum });
  }
  return { pay, rows, interest: cum, paid };
}

/** inputs: { principal $, rate % p.a., years, months, freq, extra $, ioMonths, balloon $, start 'YYYY-MM-DD' } */
export function calc(inp) {
  const p = toCents(inp.principal),
    balloon = toCents(inp.balloon || 0),
    extra = toCents(inp.extra || 0);
  const f = FREQ[inp.freq];
  const rate = Number(inp.rate);
  const months = Number(inp.years || 0) * 12 + Number(inp.months || 0);
  if (!f) return { error: 'Choose a repayment frequency.' };
  if (!(p > 0)) return { error: 'Enter a loan amount greater than zero.' };
  if (p > 1e12) return { error: 'Enter a loan amount up to $10,000,000,000.' }; // keeps cents well inside exact integer range
  if (!(rate >= 0 && rate <= 100)) return { error: 'Enter an interest rate between 0% and 100%.' };
  if (!(months > 0)) return { error: 'Enter a term of at least one month.' };
  const n = Math.round((months / 12) * f.ppy);
  if (n < 1) return { error: 'The term is shorter than one repayment.' };
  if (n > MAX_PERIODS) return { error: `That is more than ${MAX_PERIODS} repayments. Shorten the term or use monthly repayments.` };
  if (extra < 0 || balloon < 0 || Number(inp.ioMonths || 0) < 0) return { error: 'Extra repayment, balloon and interest-only period cannot be negative.' };
  if (balloon >= p) return { error: 'The balloon must be less than the loan amount.' };
  const io = Math.round((Number(inp.ioMonths || 0) / 12) * f.ppy);
  if (io >= n) return { error: 'The interest-only period must be shorter than the term.' };
  const start = inp.start || new Date().toISOString().slice(0, 10);
  const r = rate / 100 / f.ppy;
  const a = run(p, r, n, io, balloon, extra, inp.freq, start);
  const base = extra ? run(p, r, n, io, balloon, 0, inp.freq, start) : a;
  const lastRow = a.rows[a.rows.length - 1];
  return {
    principal: p,
    balloon,
    periods: n,
    scheduled: a.rows.length,
    payment: a.pay,
    ioPayment: io ? a.rows[0].payment : 0,
    ioPeriods: io,
    totalInterest: a.interest,
    totalPaid: a.paid,
    payoffDate: lastRow.date,
    rows: a.rows,
    savedInterest: base.interest - a.interest,
    savedPeriods: base.rows.length - a.rows.length,
    finalPayment: lastRow.payment + lastRow.extra,
  };
}

export const csv = (rows) =>
  [
    'Payment,Date,Repayment,Extra,Interest,Principal,Balance,Cumulative interest',
    ...rows.map((r) =>
      [r.n, r.date, plain(r.payment), plain(r.extra), plain(r.interest), plain(r.principal), plain(r.balance), plain(r.cumInterest)].join(','),
    ),
  ].join('\n');

/** "3 years 2 months" style label for a count of periods. */
export function span(periods, freq) {
  const f = FREQ[freq],
    months = Math.round((periods * 12) / f.ppy),
    y = Math.floor(months / 12),
    m = months % 12;
  return (
    [y && `${y} year${y > 1 ? 's' : ''}`, m && `${m} month${m > 1 ? 's' : ''}`].filter(Boolean).join(' ') || `${periods} ${f.noun}${periods === 1 ? '' : 's'}`
  );
}
