// Palette maths: colour harmonies (OKLCH or HSL), seeded k-means colour extraction and export formats.
import { hslToRgb, oklchToRgb, rgbToHsl, rgbToOklch, toHex } from '../color/lib.js';

export const HARMONIES = {
  complementary: 'Complementary',
  analogous: 'Analogous',
  triadic: 'Triadic',
  tetradic: 'Tetradic',
  split: 'Split-complementary',
  monochrome: 'Monochrome',
  shades: 'Shades',
};
const OFFSETS = { complementary: [0, 180], analogous: [-60, -30, 0, 30, 60], triadic: [0, 120, 240], tetradic: [0, 90, 180, 270], split: [0, 150, 210] };
const wrap = (h) => ((h % 360) + 360) % 360;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** OKLCH -> sRGB, reducing chroma (binary search) until the colour fits sRGB, so the hue and lightness are kept. */
export function oklchFit(L, C, h) {
  const fits = (c) => {
    const v = rawOklch(L, c, h);
    return v.every((x) => x >= -1e-4 && x <= 1 + 1e-4);
  };
  if (!fits(C)) {
    let lo = 0,
      hi = C;
    for (let i = 0; i < 24; i++) {
      const m = (lo + hi) / 2;
      fits(m) ? (lo = m) : (hi = m);
    }
    C = lo;
  }
  return oklchToRgb(L, C, h);
}
function rawOklch(L, C, h) {
  // linear sRGB before clamping (same matrices as color/lib.js)
  const A = C * Math.cos((h * Math.PI) / 180),
    B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3,
    m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3,
    s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

/** Harmony of `base` ({r,g,b}) as #rrggbb strings. space: 'oklch' (perceptual) or 'hsl'. The base colour is always included unchanged. */
export function harmony(base, kind, space = 'oklch') {
  const hex = (c) => toHex({ ...c, a: 1 }),
    baseHex = hex(base);
  const ok = space === 'oklch',
    o = ok ? rgbToOklch(base) : rgbToHsl({ r: Math.round(base.r), g: Math.round(base.g), b: Math.round(base.b) });
  const make = ok
    ? (h, l = o.l, c = o.c) => hex(oklchFit(clamp(l, 0, 1), c, wrap(h)))
    : (h, l = o.l, s = o.s) => hex(hslToRgb(wrap(h), clamp(s, 0, 100), clamp(l, 0, 100)));
  if (OFFSETS[kind]) return OFFSETS[kind].map((d) => (d === 0 ? baseHex : make(o.h + d)));
  const top = ok ? 1 : 100;
  if (kind === 'monochrome') {
    // five lightness levels around the base, keeping hue and chroma/saturation
    const ls = [-0.3, -0.15, 0, 0.15, 0.3].map((t) => o.l + t * top);
    const lo = Math.min(...ls),
      hi = Math.max(...ls),
      shift = lo < 0.08 * top ? 0.08 * top - lo : hi > 0.96 * top ? 0.96 * top - hi : 0;
    return ls.map((l, i) => (i === 2 && !shift ? baseHex : make(o.h, l + shift))).sort((a, b) => lum(b) - lum(a));
  }
  if (kind === 'shades') {
    // base mixed toward black in five steps (chroma eases off with lightness)
    return [0, 0.2, 0.4, 0.6, 0.8].map((t) => (t === 0 ? baseHex : ok ? make(o.h, o.l * (1 - t), o.c * (1 - t * 0.6)) : make(o.h, o.l * (1 - t))));
  }
  throw new Error(`Unknown harmony ${kind}`);
}
const lum = (h) => rgbToOklch({ r: parseInt(h.slice(1, 3), 16), g: parseInt(h.slice(3, 5), 16), b: parseInt(h.slice(5, 7), 16) }).l;

/** mulberry32 seeded PRNG. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Dominant colours of RGBA pixel data via k-means (k-means++ init with a fixed seed, so the same image always gives the same palette).
 *  Pixels under 50% alpha are ignored. Returns [{ hex, share }] sorted by share, at most k (fewer when the image has fewer distinct colours). */
export function kmeans(data, k = 6, seed = 1, maxIter = 24) {
  const px = [];
  for (let i = 0; i < data.length; i += 4) if (data[i + 3] >= 128) px.push([data[i], data[i + 1], data[i + 2]]);
  if (!px.length) return [];
  const rand = rng(seed),
    d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const cs = [px[Math.floor(rand() * px.length)].slice()];
  const dist = px.map((p) => d2(p, cs[0]));
  while (cs.length < k) {
    const total = dist.reduce((s, x) => s + x, 0);
    if (total === 0) break; // fewer distinct colours than k
    let r = rand() * total,
      i = 0;
    while ((r -= dist[i]) > 0 && i < px.length - 1) i++;
    cs.push(px[i].slice());
    for (let j = 0; j < px.length; j++) dist[j] = Math.min(dist[j], d2(px[j], px[i]));
  }
  const assign = new Int32Array(px.length);
  for (let it = 0; it < maxIter; it++) {
    let moved = 0;
    for (let j = 0; j < px.length; j++) {
      let best = 0,
        bd = Infinity;
      for (let c = 0; c < cs.length; c++) {
        const d = d2(px[j], cs[c]);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
      if (assign[j] !== best || it === 0) {
        assign[j] = best;
        moved++;
      }
    }
    const sum = cs.map(() => [0, 0, 0, 0]);
    for (let j = 0; j < px.length; j++) {
      const s = sum[assign[j]];
      s[0] += px[j][0];
      s[1] += px[j][1];
      s[2] += px[j][2];
      s[3]++;
    }
    sum.forEach((s, c) => {
      if (s[3]) cs[c] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]];
    });
    if (!moved) break;
  }
  const count = cs.map(() => 0);
  for (let j = 0; j < px.length; j++) count[assign[j]]++;
  return cs
    .map((c, i) => ({ hex: toHex({ r: c[0], g: c[1], b: c[2], a: 1 }), share: count[i] / px.length }))
    .filter((c) => c.share > 0)
    .sort((a, b) => b.share - a.share || (a.hex < b.hex ? -1 : 1));
}

/** Safe identifier for variable names: lowercase letters, digits and dashes. */
export const slug = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^[\d-]+|-+$/g, '') || 'color'; // no leading digit: $1-brand is not a valid SCSS variable

/** Export the palette (array of #rrggbb) in one of: css, tailwind, tailwind4, scss, json. */
export function exportAs(colors, fmt, name = 'palette') {
  const n = slug(name),
    keys = colors.map((_, i) => String((i + 1) * 100));
  const pairs = colors.map((c, i) => [keys[i], c]);
  switch (fmt) {
    case 'css':
      return `:root {\n${pairs.map(([k, c]) => `  --${n}-${k}: ${c};`).join('\n')}\n}`;
    case 'tailwind':
      return `// tailwind.config.js (Tailwind v3)\nmodule.exports = {\n  theme: {\n    extend: {\n      colors: {\n        '${n}': {\n${pairs.map(([k, c]) => `          ${k}: '${c}',`).join('\n')}\n        },\n      },\n    },\n  },\n};`;
    case 'tailwind4':
      return `/* Tailwind v4: in your main CSS file */\n@theme {\n${pairs.map(([k, c]) => `  --color-${n}-${k}: ${c};`).join('\n')}\n}`;
    case 'scss':
      return `$${n}: (\n${pairs.map(([k, c]) => `  ${k}: ${c},`).join('\n')}\n);`;
    case 'json':
      return JSON.stringify(Object.fromEntries(pairs), null, 2);
    default:
      throw new Error(`Unknown format ${fmt}`);
  }
}
