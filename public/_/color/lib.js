// Colour parsing, conversion (sRGB, HSL, OKLCH), WCAG contrast and shade ramps. Colours are {r,g,b,a}: r/g/b 0-255 floats, a 0-1.
const NAMES = Object.fromEntries(
  'aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c cyan 00ffff darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b darkmagenta 8b008b darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 lawngreen 7cfc00 lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 lightpink ffb6c1 lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970 mintcream f5fffa mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f pink ffc0cb plum dda0dd powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 yellowgreen 9acd32'
    .split(' ')
    .reduce((a, v, i, arr) => (i % 2 ? [...a, [arr[i - 1], v]] : a), []),
);
const BY_HEX = {};
for (const [n, h] of Object.entries(NAMES)) BY_HEX[h] ??= n;

const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));
const num = (s) => parseFloat(s);
const fromHex = (h) => ({
  r: parseInt(h.slice(0, 2), 16),
  g: parseInt(h.slice(2, 4), 16),
  b: parseInt(h.slice(4, 6), 16),
  a: h.length > 6 ? parseInt(h.slice(6, 8), 16) / 255 : 1,
});

/** Parse hex (3/4/6/8 digits), rgb[a](), hsl[a](), oklch() or a CSS colour name. Returns null when it is not a colour. */
export function parse(input) {
  const s = String(input).trim().toLowerCase();
  let m = /^#?([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(s);
  if (m) return fromHex(m[1].length < 5 ? [...m[1]].map((c) => c + c).join('') : m[1]);
  if (NAMES[s]) return fromHex(NAMES[s]);
  if (s === 'transparent') return { r: 0, g: 0, b: 0, a: 0 };
  m = /^(rgba?|hsla?|oklch)\(\s*([^)]*?)\s*\)$/.exec(s);
  if (!m) return null;
  const p = m[2].split(/\s*[,/]\s*|\s+/).filter(Boolean);
  if (p.length < 3 || p.length > 4 || !p.every((x) => /^[-+]?(\d+\.?\d*|\.\d+)(%|deg|turn)?$/.test(x))) return null;
  const alpha = p[3] === undefined ? 1 : clamp(p[3].endsWith('%') ? num(p[3]) / 100 : num(p[3]), 0, 1);
  const pct = (x, full) => (x.endsWith('%') ? (num(x) / 100) * full : num(x));
  if (m[1][0] === 'r') return { r: clamp(pct(p[0], 255), 0, 255), g: clamp(pct(p[1], 255), 0, 255), b: clamp(pct(p[2], 255), 0, 255), a: alpha };
  const h = p[m[1] === 'oklch' ? 2 : 0],
    hue = h.endsWith('turn') ? num(h) * 360 : num(h);
  if (m[1] === 'oklch') return { ...oklchToRgb(clamp(pct(p[0], 1), 0, 1), Math.max(0, pct(p[1], 0.4)), hue), a: alpha };
  return { ...hslToRgb(hue, clamp(num(p[1]), 0, 100), clamp(num(p[2]), 0, 100)), a: alpha };
}

export function hslToRgb(h, s, l) {
  s /= 100;
  l /= 100;
  const k = (n) => (n + h / 30) % 12,
    f = (n) => l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: f(0) * 255, g: f(8) * 255, b: f(4) * 255 };
}
export function rgbToHsl({ r, g, b }) {
  r /= 255;
  g /= 255;
  b /= 255;
  const mx = Math.max(r, g, b),
    mn = Math.min(r, g, b),
    d = mx - mn,
    l = (mx + mn) / 2;
  let h = 0;
  if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s: d ? (d / (1 - Math.abs(2 * l - 1))) * 100 : 0, l: l * 100 };
}

const toLin = (v) => ((v /= 255) <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const fromLin = (v) => 255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** sRGB (0-255) -> OKLCH { l: 0-1, c, h: degrees } (Ottosson's OKLab matrices). */
export function rgbToOklch({ r, g, b }) {
  const [lr, lg, lb] = [r, g, b].map(toLin);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(A, B);
  return { l: L, c, h: c < 1e-4 ? 0 : ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}
/** OKLCH -> sRGB 0-255, clamped into gamut (ponytail: clamps instead of chroma-reducing). */
export function oklchToRgb(L, C, h) {
  const A = C * Math.cos((h * Math.PI) / 180),
    B = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3,
    m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3,
    s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const [r, g, b] = lin.map((v) => clamp(fromLin(clamp(v, 0, 1)), 0, 255));
  return { r, g, b };
}

const n = (x, d) => String(+x.toFixed(d));
const byte = (v) => Math.round(clamp(v, 0, 255));
const hx = (v) => byte(v).toString(16).padStart(2, '0');
const al = (a) => (a < 1 ? ` / ${n(a * 100, 0)}%` : '');
export const toHex = (c) => '#' + hx(c.r) + hx(c.g) + hx(c.b) + (c.a < 1 ? hx(c.a * 255) : '');
export const toRgb = (c) => (c.a < 1 ? `rgba(${byte(c.r)}, ${byte(c.g)}, ${byte(c.b)}, ${n(c.a, 3)})` : `rgb(${byte(c.r)}, ${byte(c.g)}, ${byte(c.b)})`);
export const toHsl = (c) => {
  const { h, s, l } = rgbToHsl({ r: byte(c.r), g: byte(c.g), b: byte(c.b) });
  return `hsl(${n(h, 0)}, ${n(s, 0)}%, ${n(l, 0)}%${c.a < 1 ? `, ${n(c.a, 3)}` : ''})`;
};
export const toOklch = (c) => {
  const { l, c: ch, h } = rgbToOklch(c);
  return `oklch(${n(l * 100, 1)}% ${n(ch, 4)} ${n(h, 2)}${al(c.a)})`;
};
/** CSS colour name when the colour is exactly one (opaque only). */
export const nameOf = (c) => (c.a === 1 ? (BY_HEX[toHex(c).slice(1)] ?? null) : null);

/** WCAG 2.x relative luminance and contrast ratio. */
export const luminance = ({ r, g, b }) => 0.2126 * toLin(r) + 0.7152 * toLin(g) + 0.0722 * toLin(b);
export const contrast = (a, b) => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
export const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
export const verdicts = (ratio) => ({ aaNormal: ratio >= 4.5, aaLarge: ratio >= 3, aaaNormal: ratio >= 7, aaaLarge: ratio >= 4.5 });

/** 9 steps (100..900): lighter tints above, darker shades below; step 500 is the input colour. */
export function ramp(c) {
  const { l, c: ch, h } = rgbToOklch(c),
    hi = Math.max(l, 0.97),
    lo = Math.min(l, 0.2);
  return [100, 200, 300, 400, 500, 600, 700, 800, 900].map((step, i) => {
    if (i === 4) return { step, hex: toHex({ ...c, a: 1 }) };
    const t = Math.abs(4 - i) / 4;
    const rgb = oklchToRgb(i < 4 ? l + (hi - l) * t : l + (lo - l) * t, ch * (1 - (i < 4 ? 0.75 : 0.4) * t), h);
    return { step, hex: toHex({ ...rgb, a: 1 }) };
  });
}

/** sRGB 0-255 -> HSV { h: 0-360, s: 0-1, v: 0-1 }. */
export function rgbToHsv({ r, g, b }) {
  const [R, G, B] = [r, g, b].map((x) => x / 255),
    mx = Math.max(R, G, B),
    d = mx - Math.min(R, G, B);
  const h = d === 0 ? 0 : (mx === R ? ((G - B) / d) % 6 : mx === G ? (B - R) / d + 2 : (R - G) / d + 4) * 60;
  return { h: (h + 360) % 360, s: mx === 0 ? 0 : d / mx, v: mx };
}
/** HSV -> sRGB 0-255 (alpha 1). */
export function hsvToRgb(h, s, v) {
  const f = (k) => {
    const x = (k + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(x, 4 - x, 1));
  };
  return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255, a: 1 };
}

/** CSS variables that tint the whole page from the chosen color (dark or light page). The accent is the color itself, nudged until it reads (>= 4.5:1) on the page background. */
export function pageTheme(fg, dark) {
  const { l, c, h } = rgbToOklch(fg),
    t = Math.min(c, dark ? 0.045 : 0.025);
  const hex = (L, C) => toHex(oklchToRgb(L, C, h));
  const bg = oklchToRgb(dark ? 0.17 : 0.97, t, h);
  let L = l,
    acc = { ...oklchToRgb(L, c, h), a: 1 };
  const card = oklchToRgb(dark ? 0.21 : 0.995, t * 1.1, h);
  for (let i = 0; i < 80 && (contrast(acc, bg) < 4.5 || contrast(acc, card) < 4.5); i++) {
    L = clamp(L + (dark ? 0.015 : -0.015), 0, 1);
    acc = { ...oklchToRgb(L, c, h), a: 1 };
  }
  const ink = contrast(acc, { r: 0, g: 0, b: 0, a: 1 }) >= contrast(acc, { r: 255, g: 255, b: 255, a: 1 }) ? '#000000' : '#ffffff';
  return {
    '--bg': toHex(bg),
    '--card': hex(dark ? 0.21 : 0.995, t * 1.1),
    '--line': hex(dark ? 0.32 : 0.88, t * 1.4),
    '--fg': hex(dark ? 0.93 : 0.22, Math.min(c, 0.03)),
    '--muted': hex(dark ? 0.7 : 0.5, Math.min(c, 0.05)),
    '--accent': toHex(acc),
    '--accent-fg': ink,
  };
}
