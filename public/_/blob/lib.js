// Seeded random blob shapes: points on a ring, joined by a smooth closed Catmull-Rom spline written as cubic beziers.
/** xmur3 string hash -> 32-bit seed. */
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}
/** mulberry32: deterministic PRNG returning floats in [0, 1). */
export function rng(seed) {
  let a = hashSeed(String(seed));
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const newSeed = () => Math.random().toString(36).slice(2, 8);
const r2 = (x) => Math.round(x * 100) / 100;
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

/** n points (3-12) around a ring in a size x size box. randomness 0 = regular polygon-ish circle, 1 = very lumpy. */
export function points(seed, n, randomness, size) {
  n = clamp(Math.round(n) || 3, 3, 12);
  randomness = clamp(+randomness || 0, 0, 1);
  const rand = rng(seed),
    c = size / 2,
    out = [];
  for (let i = 0; i < n; i++) {
    const jitterA = (rand() - 0.5) * ((Math.PI * 2) / n) * 0.5 * randomness;
    // 0.92: the spline overshoots its points by up to ~5.4% of the radius (checked over 45k shapes), so this keeps it inside the box
    const radius = c * 0.92 * (1 - randomness * 0.65 * rand());
    const a = (i / n) * Math.PI * 2 + jitterA;
    out.push([c + Math.cos(a) * radius, c + Math.sin(a) * radius]);
  }
  return out;
}
/** Closed smooth path through the points (Catmull-Rom tension 1/6 converted to cubic beziers). */
export function pathFrom(pts) {
  const n = pts.length,
    f = (p) => `${r2(p[0])} ${r2(p[1])}`;
  let d = `M${f(pts[0])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n],
      p1 = pts[i],
      p2 = pts[(i + 1) % n],
      p3 = pts[(i + 2) % n];
    d += `C${r2(p1[0] + (p2[0] - p0[0]) / 6)} ${r2(p1[1] + (p2[1] - p0[1]) / 6)} ${r2(p2[0] - (p3[0] - p1[0]) / 6)} ${r2(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2)}`;
  }
  return d + 'Z';
}
export const blobPath = ({ seed, n, randomness, size }) => pathFrom(points(seed, n, randomness, size));

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (v, d) => (HEX.test(v) ? v : d);
/** Complete SVG document. fill: { mode: 'solid'|'gradient', a, b, angle }, stroke: { on, color, width }. */
export function toSvg({ d, size, fill, stroke }) {
  const a = hex(fill.a, '#0b7a35'),
    b = hex(fill.b, '#7dff9b'),
    ang = ((+fill.angle || 0) * Math.PI) / 180;
  const g = fill.mode === 'gradient';
  const dx = Math.cos(ang) / 2,
    dy = Math.sin(ang) / 2,
    f = (v) => r2(0.5 + v);
  const defs = g
    ? `<defs><linearGradient id="g" x1="${f(-dx)}" y1="${f(-dy)}" x2="${f(dx)}" y2="${f(dy)}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient></defs>`
    : '';
  const sw = stroke.on ? clamp(+stroke.width || 0, 0, 40) : 0,
    pad = sw / 2,
    vb = `${-pad} ${-pad} ${size + sw} ${size + sw}`; // room for the outline
  const st = stroke.on ? ` stroke="${hex(stroke.color, '#000000')}" stroke-width="${sw}" stroke-linejoin="round"` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="${size}" height="${size}">${defs}<path d="${d}" fill="${g ? 'url(#g)' : a}"${st}/></svg>`;
}
export const toClip = (d) => `clip-path: path('${d}');`;
/** Seed from a location hash like #seed=abc&n=7 (strings only, parsed defensively). */
export function parseHash(h) {
  const p = new URLSearchParams(String(h).replace(/^#/, '')),
    o = {};
  const seed = p.get('seed');
  if (seed) o.seed = seed.slice(0, 40);
  for (const k of ['n', 'r']) if (p.has(k) && Number.isFinite(+p.get(k))) o[k] = +p.get(k);
  return o;
}
