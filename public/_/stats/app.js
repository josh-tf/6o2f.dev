import { $, esc, mountBar } from '/_/ui.js';
import { parse, describe, histogram, sturges, fmt } from '/_/stats/lib.js';
await mountBar('Statistics');

// Example: one-way commute times in minutes for 40 people (one long-haul outlier).
const EXAMPLE = `32, 25, 41, 18, 27, 35, 22, 29, 38, 44
26, 31, 19, 24, 33, 28, 36, 21, 30, 27
45, 23, 34, 29, 40, 25, 31, 22, 37, 28
26, 33, 30, 24, 39, 27, 35, 29, 95, 31`;
const LIST_MAX = 2000; // ponytail: the sorted list renders at most this many chips; stats still use every value
let d = null,
  binsAuto = true;

function row(label, v, title = '') {
  return `<tr><th scope="row"${title ? ` title="${esc(title)}"` : ''}>${label}</th><td class="v">${esc(v)}</td></tr>`;
}
const list = (a, max = 8) => (a.length ? a.slice(0, max).map(fmt).join(', ') + (a.length > max ? ` and ${a.length - max} more` : '') : 'none');

function update() {
  const { nums, skipped } = parse($('#data').value);
  const notes = [];
  if (nums.length) notes.push(`${nums.length.toLocaleString()} number${nums.length > 1 ? 's' : ''} read.`);
  if (skipped.length)
    notes.push(
      `Ignored ${skipped.length} non-numeric item${skipped.length > 1 ? 's' : ''}: ${skipped
        .slice(0, 5)
        .map((s) => `"${s.slice(0, 20)}"`)
        .join(', ')}${skipped.length > 5 ? ', …' : ''}.`,
    );
  $('#note').textContent = notes.join(' ');
  $('#err').textContent = nums.length
    ? ''
    : $('#data').value.trim()
      ? 'No numbers found. Separate values with commas, spaces or new lines (use a dot for decimals).'
      : 'Paste or type some numbers to begin.';
  $('#out').hidden = !nums.length;
  if (!nums.length) {
    d = null;
    return;
  }
  d = describe(nums, $('#method').value);
  const modes = d.modes.length ? `${list(d.modes, 5)} (×${d.modeCount})` : 'none (all values unique)';
  $('#t-centre tbody').innerHTML =
    row('Count', d.n.toLocaleString()) +
    row('Sum', fmt(d.sum)) +
    row('Mean', fmt(d.mean)) +
    row('Median', fmt(d.median)) +
    row('Mode', modes) +
    row('Min', fmt(d.min)) +
    row('Max', fmt(d.max));
  $('#t-spread tbody').innerHTML =
    row('Range', fmt(d.range)) +
    row('Std dev (sample)', fmt(d.sampSd)) +
    row('Std dev (population)', fmt(d.popSd)) +
    row('Variance (sample)', fmt(d.sampVar)) +
    row('Variance (population)', fmt(d.popVar)) +
    row('Std error of mean', fmt(d.sem)) +
    row('Coeff. of variation', Number.isFinite(d.cv) ? `${fmt(+(d.cv * 100).toFixed(2))}%` : '—');
  $('#t-shape tbody').innerHTML =
    row('Q1', fmt(d.q1)) +
    row('Q3', fmt(d.q3)) +
    row('IQR', fmt(d.iqr)) +
    row('Lower fence', fmt(d.fences[0])) +
    row('Upper fence', fmt(d.fences[1])) +
    row('Outliers', list(d.outliers)) +
    row('Skewness', fmt(+d.skew.toFixed(6))) +
    row('Excess kurtosis', fmt(+d.kurt.toFixed(6)));
  $('#t-pct thead').innerHTML = `<tr><th scope="row">Percentile</th>${d.percentiles.map(([p]) => `<th scope="col">P${p}</th>`).join('')}</tr>`;
  $('#t-pct tbody').innerHTML = `<tr><th scope="row">Value</th>${d.percentiles.map(([, v]) => `<td>${fmt(v)}</td>`).join('')}</tr>`;
  if (binsAuto) $('#bins').value = Math.min(200, sturges(d.n));
  hist();
  const out = new Set(d.outliers);
  $('#list').innerHTML = d.sorted
    .slice(0, LIST_MAX)
    .map((x) => `<li${out.has(x) ? ' class="out"' : ''}>${fmt(x)}${out.has(x) ? '<span class="vh"> (outlier)</span>' : ''}</li>`)
    .join('');
  $('#listnote').textContent =
    `Smallest to largest${d.outliers.length ? '; outliers are outlined in red' : ''}.${d.n > LIST_MAX ? ` Showing the first ${LIST_MAX.toLocaleString()} of ${d.n.toLocaleString()}.` : ''}`;
}

function hist() {
  if (!d) return;
  const bins = Number($('#bins').value);
  if (!(bins >= 1 && bins <= 200)) return;
  const h = histogram(d.sorted, bins),
    W = 640,
    H = 240,
    L = 40,
    R = 10,
    T = 10,
    B = 34;
  const top = Math.max(...h.map((b) => b.count)),
    bw = (W - L - R) / h.length;
  const y = (c) => T + (H - T - B) * (1 - c / top);
  let g = '';
  const yStep = Math.max(1, Math.ceil(top / 4));
  for (let c = 0; c <= top; c += yStep)
    g += `<line class="ax" x1="${L}" x2="${W - R}" y1="${y(c)}" y2="${y(c)}"/><text x="${L - 6}" y="${y(c) + 4}" text-anchor="end">${c}</text>`;
  h.forEach((b, i) => {
    g += `<rect x="${(L + i * bw + 1).toFixed(1)}" y="${y(b.count).toFixed(1)}" width="${Math.max(1, bw - 2).toFixed(1)}" height="${(H - B - y(b.count)).toFixed(1)}"><title>${fmt(b.lo)} to ${fmt(b.hi)}: ${b.count}</title></rect>`;
  });
  const every = Math.ceil((h.length + 1) / 7);
  for (let i = 0; i <= h.length; i += every)
    g += `<text x="${L + i * bw}" y="${H - 12}" text-anchor="${i === 0 ? 'start' : i === h.length ? 'end' : 'middle'}">${fmt(+(i === h.length ? h[i - 1].hi : h[i].lo).toPrecision(4))}</text>`;
  $('#hist').innerHTML = g;
  const peak = h.reduce((a, b) => (b.count > a.count ? b : a));
  $('#hist').setAttribute(
    'aria-label',
    `Histogram of ${d.n} values in ${h.length} bins from ${fmt(d.min)} to ${fmt(d.max)}. The tallest bin, ${fmt(peak.lo)} to ${fmt(peak.hi)}, holds ${peak.count}.`,
  );
}

async function copy(text) {
  const msg = $('#msg');
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = 'Copied the summary as tab-separated rows.';
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    msg.textContent = ok ? 'Copied the summary.' : 'Copy blocked by the browser. Select the table and press Ctrl+C.';
  }
}

let timer;
$('#data').addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(update, $('#data').value.length > 20000 ? 250 : 0);
});
$('#method').addEventListener('change', update);
$('#bins').addEventListener('input', () => {
  binsAuto = false;
  hist();
});
$('#auto').addEventListener('click', () => {
  binsAuto = true;
  update();
});
$('#example').addEventListener('click', () => {
  $('#data').value = EXAMPLE;
  binsAuto = true;
  update();
});
$('#clear').addEventListener('click', () => {
  $('#data').value = '';
  update();
  $('#data').focus();
});
$('#copy').addEventListener('click', () => {
  if (!d) return;
  const rows = [...document.querySelectorAll('.tables tr, #t-pct tr')].map((tr) =>
    [...tr.children].map((c) => c.textContent.replace(/\s*\(outlier\)/, '')).join('\t'),
  );
  copy(rows.join('\n'));
});
$('#data').value = EXAMPLE;
update();
