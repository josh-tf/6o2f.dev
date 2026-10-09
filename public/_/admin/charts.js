// Helpers shared by the admin and labyrinth pages: formatting, small charts (SVG/HTML strings; colours come from CSS
// classes) and the tab strip.
import { $, esc } from '/_/ui.js';

export const ago = (ms) => {
  if (!ms) return 'never';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  if (s < 90) return 'just now';
  const u = [
    [60, 'min'],
    [3600, 'h'],
    [86400, 'd'],
    [2592000, 'mo'],
    [31536000, 'y'],
  ];
  let out = `${Math.floor(s / 60)} min`;
  for (let i = 0; i < u.length - 1; i++) if (s >= u[i][0] && s < u[i + 1][0]) out = `${Math.floor(s / u[i][0])} ${u[i][1]}`;
  if (s >= 31536000) out = `${Math.floor(s / 31536000)} y`;
  return `${out} ago`;
};
export const num = (n) => Number(n).toLocaleString('en-US');
export const pct = (a, b) => (b ? `${(Math.round((a / b) * 1000) / 10).toFixed(1)}%` : '0%');
export const when = (ms) =>
  ms ? `<time datetime="${new Date(ms).toISOString()}" title="${esc(new Date(ms).toLocaleString())}">${ago(ms).replace(' ago', '')}</time>` : '—';
export const bars = (items, empty = 'No data yet.') => {
  if (!items.length) return `<p class="empty">${empty}</p>`;
  const max = Math.max(...items.map((i) => i.n)),
    tot = items.reduce((a, i) => a + i.n, 0);
  return items
    .map(
      (i) =>
        `<div class="brow"><span>${esc(i.key)}</span><span class="tr"><i style="width:${Math.max(2, (i.n / max) * 100)}%"></i></span><span class="v">${num(i.n)} · ${pct(i.n, tot)}</span></div>`,
    )
    .join('');
};
export function stacked(labels, series, aria) {
  const W = 640,
    H = 180,
    L = 34,
    B = 22,
    T = 8,
    w = W - L - 4,
    h = H - B - T;
  const tot = labels.map((_, i) => series.reduce((a, s) => a + s.vals[i], 0)),
    max = Math.max(1, ...tot);
  const nice = (m) => {
      const p = 10 ** Math.floor(Math.log10(m));
      return Math.ceil(m / p) * p;
    },
    top = nice(max);
  const bw = w / labels.length,
    y = (v) => T + h - (v / top) * h;
  const grid = [0, 0.5, 1]
    .map(
      (f) =>
        `<line class="grid" x1="${L}" x2="${W - 4}" y1="${y(top * f)}" y2="${y(top * f)}"/><text x="${L - 4}" y="${y(top * f) + 3}" text-anchor="end">${num(Math.round(top * f))}</text>`,
    )
    .join('');
  const cols = labels
    .map((lab, i) => {
      let acc = 0;
      const x = L + i * bw + bw * 0.18,
        bwi = bw * 0.64;
      const segs = series
        .map((s) => {
          const v = s.vals[i];
          if (!v) return '';
          const y0 = y(acc),
            y1 = y(acc + v);
          acc += v;
          return `<rect class="${s.cls}" x="${x}" y="${y1}" width="${bwi}" height="${Math.max(1, y0 - y1)}" rx="2"><title>${esc(lab)}: ${num(v)} ${esc(s.label)}</title></rect>`;
        })
        .join('');
      return `${segs}<text x="${x + bwi / 2}" y="${H - 6}" text-anchor="middle">${esc(lab)}</text>${tot[i] ? `<text class="tot" x="${x + bwi / 2}" y="${y(tot[i]) - 4}" text-anchor="middle">${num(tot[i])}</text>` : ''}`;
    })
    .join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(aria)}">${grid}${cols}</svg>`;
}
export function topN(items, n) {
  const isOther = (i) => i.key.toLowerCase() === 'other';
  const named = items.filter((i) => !isOther(i)),
    top = named.slice(0, n);
  const rest = items.reduce((a, i) => a + i.n, 0) - top.reduce((a, i) => a + i.n, 0);
  return rest ? [...top, { key: 'Other', n: rest }] : top;
}
export const spark = (series) => {
  const m = Math.max(1, ...series),
    n = series.length;
  return `<svg class="spark" viewBox="0 0 90 22" aria-hidden="true"><polyline points="${series.map((v, i) => `${(i / Math.max(1, n - 1)) * 90},${21 - (v / m) * 20}`).join(' ')}"/></svg>`;
};

/** Wires the page's `.tabs` strip (WAI-ARIA tabs, automatic activation): panels are #p-<key>, `hashes` maps key → URL hash,
 * `load[key]` runs each time that tab is shown. Returns showTab(key). */
export function mountTabs(hashes, load = {}) {
  const strip = $('.tabs');
  function showTab(t) {
    for (const b of strip.querySelectorAll('[role=tab]')) {
      b.setAttribute('aria-selected', String(b.dataset.t === t));
      b.tabIndex = b.dataset.t === t ? 0 : -1;
    }
    for (const k of Object.keys(hashes)) $(`#p-${k}`).hidden = k !== t;
    try {
      history.replaceState(null, '', hashes[t]);
    } catch {}
    load[t]?.();
  }
  strip.addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]');
    if (b) showTab(b.dataset.t);
  });
  // Arrow keys / Home / End move between tabs.
  strip.addEventListener('keydown', (e) => {
    const tabs = [...strip.querySelectorAll('[role=tab]')],
      i = tabs.indexOf(e.target);
    const j = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (i < 0 || j === undefined) return;
    e.preventDefault();
    const next = tabs[(j + tabs.length) % tabs.length];
    showTab(next.dataset.t);
    next.focus();
  });
  return showTab;
}
