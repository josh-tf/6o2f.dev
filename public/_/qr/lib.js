import qrcode from './vendor/qrcode.mjs';
qrcode.stringToBytes = (s) => [...new TextEncoder().encode(s)]; // UTF-8 payloads

/** Module matrix (array of boolean rows). ecc: L|M|Q|H. Throws if the text does not fit. */
export function matrix(text, ecc = 'M') {
  const q = qrcode(0, ecc);
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}
// Each payload builder returns '' when the essential field is empty, so the page shows its empty state instead of a useless code.
export const wifi = ({ ssid, pass = '', sec = 'WPA', hidden = false }) => {
  if (!ssid) return '';
  const e = (s) => s.replace(/([\\;,:"])/g, '\\$1');
  return `WIFI:T:${sec};S:${e(ssid)};${sec === 'nopass' ? '' : `P:${e(pass)};`}${hidden ? 'H:true;' : ''};`;
};
export const mailto = ({ to, subject = '', body = '' }) => {
  const q = [subject && `subject=${encodeURIComponent(subject)}`, body && `body=${encodeURIComponent(body)}`].filter(Boolean).join('&');
  return to.trim() || q ? `mailto:${to.trim()}${q ? '?' + q : ''}` : '';
};
export const tel = (n) => (/\d/.test(n) ? 'tel:' + n.replace(/[^\d+]/g, '') : '');

const lum = (h) => {
  const v = parseInt(h.slice(1), 16);
  return [v >> 16, (v >> 8) & 255, v & 255]
    .map((c) => {
      c /= 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    })
    .reduce((a, c, i) => a + c * [0.2126, 0.7152, 0.0722][i], 0);
};
export const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
/** Returns a warning string or ''. Scanners expect dark modules on a light background. */
export const contrastWarning = (fg, bg) =>
  contrast(fg, bg) < 3
    ? 'Low contrast: this will probably not scan.'
    : lum(fg) > lum(bg)
      ? 'Light modules on a dark background: many scanners cannot read inverted codes.'
      : '';

/** SVG with one path for all dark modules; size = (n + 2*quiet) modules. */
export function svg(m, { fg, bg, quiet = 4 }) {
  const t = m.length + 2 * quiet;
  const d = m
    .flatMap((row, r) => row.map((on, c) => on && `M${c + quiet} ${r + quiet}h1v1h-1z`))
    .filter(Boolean)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${t} ${t}" shape-rendering="crispEdges"><rect width="${t}" height="${t}" fill="${bg}"/><path d="${d}" fill="${fg}"/></svg>`;
}
export function draw(canvas, m, { fg, bg, quiet = 4, scale = 8 }) {
  const t = m.length + 2 * quiet;
  canvas.width = canvas.height = t * scale;
  const x = canvas.getContext('2d');
  x.fillStyle = bg;
  x.fillRect(0, 0, t * scale, t * scale);
  x.fillStyle = fg;
  m.forEach((row, r) => row.forEach((on, c) => on && x.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale)));
  return t * scale;
}
