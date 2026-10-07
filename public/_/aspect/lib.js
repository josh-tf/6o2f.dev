// Aspect ratio maths. Pure functions, no DOM.
export const gcd = (a, b) => {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

/** Simplest whole-number ratio of w:h. Decimals are scaled up first (1.85 x 1 -> 37:20). */
export function simplify(w, h) {
  if (!(w > 0 && h > 0)) return null;
  let k = 1;
  while (k < 1e6 && (!Number.isInteger(Math.round(w * k * 1e9) / 1e9) || !Number.isInteger(Math.round(h * k * 1e9) / 1e9))) k *= 10;
  const a = Math.round(w * k),
    b = Math.round(h * k),
    g = gcd(a, b);
  return [a / g, b / g];
}

const PHI = (1 + Math.sqrt(5)) / 2;
/** Presets: label, w, h (w/h is the ratio). */
export const PRESETS = [
  ['16:9', 16, 9],
  ['4:3', 4, 3],
  ['1:1', 1, 1],
  ['21:9', 21, 9],
  ['9:16', 9, 16],
  ['3:2', 3, 2],
  ['16:10', 16, 10],
  ['A4', 210, 297],
  ['US Letter', 8.5, 11],
  ['Golden', PHI, 1],
];

/** Common ratios used to name an arbitrary size, checked within 1%. 21:9 "ultrawide" covers 64:27 and 43:18 panels. */
const NAMED = [
  ['16:9', 16 / 9],
  ['4:3', 4 / 3],
  ['1:1', 1],
  ['3:2', 1.5],
  ['16:10', 1.6],
  ['5:4', 1.25],
  ['21:9 ultrawide', 64 / 27],
  ['21:9 ultrawide', 43 / 18],
  ['32:9 super ultrawide', 32 / 9],
  ['2:1', 2],
  ['1.85:1 cinema flat', 1.85],
  ['2.39:1 cinema scope', 2.39],
  ['ISO 216 (A4) √2', Math.SQRT2],
  ['US Letter', 11 / 8.5],
  ['Golden ratio', PHI],
  ['5:3', 5 / 3],
];
export function nearestName(w, h) {
  const r = Math.max(w, h) / Math.min(w, h);
  let best = null;
  for (const [name, v] of NAMED) {
    const e = Math.abs(r / v - 1);
    if (e < 0.01 && (!best || e < best.e)) best = { name, e };
  }
  if (!best) return null;
  const numeric = /^\d+(\.\d+)?:\d+/.test(best.name);
  const name =
    w === h || !numeric
      ? best.name + (w === h || best.name === '1:1' ? '' : w < h ? ' (portrait)' : ' (landscape)')
      : w < h
        ? best.name.replace(/^(\d+(?:\.\d+)?):(\d+)/, '$2:$1')
        : best.name;
  return { name, exact: best.e < 1e-9 };
}

/** Resize keeping the ratio. */
export const heightFor = (newW, w, h) => (newW * h) / w;
export const widthFor = (newH, w, h) => (newH * w) / h;

/** Fit a src rectangle into a box. contain = whole image visible (letterbox), cover = box filled (edges cropped). */
export function fit(sw, sh, bw, bh) {
  const c = Math.min(bw / sw, bh / sh),
    v = Math.max(bw / sw, bh / sh);
  const contain = { w: Math.round(sw * c), h: Math.round(sh * c), scale: c };
  const cover = { w: Math.round(sw * v), h: Math.round(sh * v), scale: v };
  return { contain, cover, bars: { x: bw - contain.w, y: bh - contain.h }, cropped: { x: cover.w - bw, y: cover.h - bh } };
}

/** Largest centred crop of a w x h image that has ratio a:b. */
export function crop(w, h, a, b) {
  let cw = w,
    ch = Math.round((w * b) / a);
  if (ch > h) {
    ch = h;
    cw = Math.round((h * a) / b);
  }
  return { w: cw, h: ch, x: Math.floor((w - cw) / 2), y: Math.floor((h - ch) / 2) };
}

/** Pixel density for a screen of w x h pixels and a diagonal in inches. */
export function ppi(w, h, diag) {
  const p = Math.hypot(w, h) / diag;
  return { ppi: p, pitchMm: 25.4 / p, widthIn: w / p, heightIn: h / p };
}

/** Well-known resolutions; `of` filters to those matching w:h within 0.5%. */
export const RES = [
  [640, 360, 'nHD'],
  [854, 480, '480p (FWVGA)'],
  [1280, 720, '720p HD'],
  [1366, 768, 'WXGA laptop'],
  [1600, 900, 'HD+'],
  [1920, 1080, '1080p Full HD'],
  [2560, 1440, '1440p QHD'],
  [3840, 2160, '4K UHD'],
  [5120, 2880, '5K'],
  [7680, 4320, '8K UHD'],
  [640, 480, 'VGA'],
  [800, 600, 'SVGA'],
  [1024, 768, 'XGA (iPad)'],
  [1400, 1050, 'SXGA+'],
  [1600, 1200, 'UXGA'],
  [2048, 1536, 'QXGA (iPad Retina)'],
  [1280, 800, 'WXGA'],
  [1440, 900, 'WXGA+'],
  [1680, 1050, 'WSXGA+'],
  [1920, 1200, 'WUXGA'],
  [2560, 1600, 'WQXGA'],
  [2880, 1800, 'MacBook Pro 15″'],
  [2560, 1080, 'UW-FHD'],
  [3440, 1440, 'UW-QHD'],
  [3840, 1600, 'UW-QHD+'],
  [5120, 2160, 'UW 5K2K'],
  [5120, 1440, 'DQHD 32:9'],
  [1080, 1080, 'Instagram square'],
  [1080, 1350, 'Instagram portrait 4:5'],
  [1080, 1920, 'Stories, Reels, Shorts, TikTok'],
  [720, 1280, 'Vertical 720p'],
  [1280, 1024, 'SXGA 5:4'],
  [2160, 1440, 'Surface 3:2'],
  [3000, 2000, '6 MP camera 3:2'],
  [6000, 4000, '24 MP camera 3:2'],
  [4096, 2160, 'DCI 4K'],
  [1998, 1080, 'DCI flat 1.85'],
  [2048, 858, 'DCI scope 2.39'],
  [1200, 630, 'Open Graph image'],
  [1500, 500, 'X header 3:1'],
];
export const resolutionsFor = (w, h) => RES.filter(([rw, rh]) => Math.abs(rw / rh / (w / h) - 1) < 0.005);

/** Rounded to `d` decimals, trailing zeros dropped. */
export const round = (x, d = 2) => String(+x.toFixed(d));
