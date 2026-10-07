// Icon geometry shared by canvas drawing and SVG output.
// o: {text, shape:'square'|'rounded'|'circle', bg, bg2 (''=solid), fg, weight}
const FONT = 'system-ui,"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
export const fontSize = (o, size) => Math.round(size * ([...o.text].length > 1 && !/\p{Extended_Pictographic}/u.test(o.text) ? 0.5 : 0.62));
export const radius = (o, size) => (o.shape === 'circle' ? size / 2 : o.shape === 'rounded' ? size * 0.22 : 0);
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function svgIcon(o, size = 512) {
  const r = radius(o, size);
  const fill = o.bg2 ? 'url(#g)' : o.bg;
  const defs = o.bg2
    ? `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${o.bg}"/><stop offset="1" stop-color="${o.bg2}"/></linearGradient></defs>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">${defs}<rect width="${size}" height="${size}" rx="${r}" fill="${fill}"/><text x="50%" y="50%" dy=".1em" text-anchor="middle" dominant-baseline="central" font-family='${FONT.replace(/"/g, '&quot;')}' font-size="${fontSize(o, size)}" font-weight="${o.weight}" fill="${o.fg}">${esc(o.text)}</text></svg>`;
}
export function drawIcon(ctx, o, size) {
  const r = radius(o, size);
  ctx.clearRect(0, 0, size, size);
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, r);
  ctx.clip();
  if (o.bg2) {
    const g = ctx.createLinearGradient(0, 0, size, size);
    g.addColorStop(0, o.bg);
    g.addColorStop(1, o.bg2);
    ctx.fillStyle = g;
  } else ctx.fillStyle = o.bg;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = o.fg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${o.weight} ${fontSize(o, size)}px ${FONT}`;
  ctx.fillText(o.text, size / 2, size / 2 + size * 0.04);
}
export const SIZES = [16, 32, 48, 180, 512];
export const linkTags = `<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="icon" href="/favicon-16.png" sizes="16x16" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">`;

/** First two graphemes (so a ZWJ emoji or a flag stays whole); '?' when empty. */
export const iconText = (s) =>
  [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(s.trim())]
    .slice(0, 2)
    .map((x) => x.segment)
    .join('') || '?';

/** Pack PNG images into a .ico file (PNG-in-ICO, supported by every current browser and Windows Vista+). imgs: [{size, png: Uint8Array}] */
export function ico(imgs) {
  const head = 6 + 16 * imgs.length,
    total = imgs.reduce((n, i) => n + i.png.length, head);
  const out = new Uint8Array(total),
    v = new DataView(out.buffer);
  v.setUint16(2, 1, true);
  v.setUint16(4, imgs.length, true);
  let off = head;
  imgs.forEach(({ size, png }, k) => {
    const e = 6 + 16 * k;
    out[e] = out[e + 1] = size >= 256 ? 0 : size; // 0 means 256
    v.setUint16(e + 4, 1, true);
    v.setUint16(e + 6, 32, true);
    v.setUint32(e + 8, png.length, true);
    v.setUint32(e + 12, off, true);
    out.set(png, off);
    off += png.length;
  });
  return out;
}
