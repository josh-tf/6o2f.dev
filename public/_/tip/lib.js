// Bill splitting in integer minor units (cents). Pure functions, no DOM.
export const digitsOf = (currency, locale) => new Intl.NumberFormat(locale, { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
export const toMinor = (v, digits = 2) => Math.round(Number(v) * 10 ** digits + 1e-9 * Math.sign(v));
export const fmt = (minor, currency, locale) => {
  const d = digitsOf(currency, locale);
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(minor / 10 ** d);
};

/** Split `total` (integer) across weights by largest remainder: shares always sum to total exactly; ties go to the earlier person. */
export function allocate(total, weights) {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return weights.map(() => 0);
  const exact = weights.map((w) => (total * w) / sum),
    out = exact.map(Math.floor);
  let left = total - out.reduce((a, b) => a + b, 0);
  const order = exact.map((e, i) => [e - out[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) out[order[k][1]]++;
  return out;
}

/** bill: minor units. tipPct, taxPct: percent. weights: one per person (> 0 for at least one).
 *  taxIncluded: the bill already contains tax. tipOnPreTax: tip is worked out on the amount before tax.
 *  roundUp: each person's payment is rounded up to a whole currency unit (the extra becomes tip). unit: minor units per whole unit. */
export function split({ bill, tipPct = 0, taxPct = 0, taxIncluded = false, tipOnPreTax = true, weights = [1], roundUp = false, unit = 100 }) {
  if (!Number.isFinite(bill) || bill < 0) return { error: 'Enter a bill amount of zero or more.' };
  if (!(tipPct >= 0 && tipPct <= 1000)) return { error: 'Enter a tip between 0% and 1000%.' };
  if (!(taxPct >= 0 && taxPct <= 100)) return { error: 'Enter a tax rate between 0% and 100%.' };
  if (!weights.length || weights.some((w) => !(w >= 0))) return { error: 'Shares must be zero or more.' };
  if (!(weights.reduce((a, b) => a + b, 0) > 0)) return { error: 'Give at least one person a share greater than zero.' };
  const t = taxPct / 100;
  const tax = taxIncluded ? Math.round((bill * t) / (1 + t)) : Math.round(bill * t);
  const subtotal = taxIncluded ? bill - tax : bill,
    pre = subtotal + tax;
  const tip = Math.round(((tipOnPreTax ? subtotal : pre) * tipPct) / 100);
  // Allocate the grand total once (so remainder cents never stack on one person), then derive each tip from it.
  const base = allocate(pre, weights),
    totals = allocate(pre + tip, weights);
  let people = base.map((b, i) => ({ share: weights[i], base: b, tip: totals[i] - b, total: totals[i] }));
  if (roundUp)
    people = people.map((p) => {
      const total = p.total === 0 ? 0 : Math.ceil(p.total / unit) * unit;
      return { ...p, tip: p.tip + total - p.total, total };
    });
  const total = people.reduce((a, p) => a + p.total, 0),
    tipTotal = tip + total - (pre + tip);
  return { subtotal, tax, pre, tip: tipTotal, total, tipPct: subtotal + tax ? (tipTotal / (tipOnPreTax ? subtotal : pre)) * 100 : 0, people };
}
