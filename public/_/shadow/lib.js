// Pure shadow CSS builder. layer: {x,y,blur,spread,color:'#rrggbb',alpha:0-1,inset}
export function rgba(hex, a) {
  const v = parseInt(hex.slice(1), 16);
  return `rgba(${v >> 16}, ${(v >> 8) & 255}, ${v & 255}, ${+(+a).toFixed(2)})`;
}
const px = (v) => (+v || 0) + (+v ? 'px' : '');
export function layerCss(l, text) {
  const parts = [px(l.x), px(l.y), px(l.blur)];
  if (!text) parts.push(px(l.spread));
  parts.push(rgba(l.color, l.alpha));
  return (!text && l.inset ? 'inset ' : '') + parts.join(' ');
}
export const shadowValue = (layers, text = false) => (layers.length ? layers.map((l) => layerCss(l, text)).join(',\n    ') : 'none');
export const shadowCss = (layers, text = false) => `${text ? 'text' : 'box'}-shadow: ${shadowValue(layers, text)};`;
const L = (x, y, blur, spread, color, alpha, inset = false) => ({ x, y, blur, spread, color, alpha, inset });
export const PRESETS = {
  Soft: [L(0, 4, 16, 0, '#000000', 0.15)],
  Layered: [
    L(0, 1, 1, 0, '#000000', 0.12),
    L(0, 2, 2, 0, '#000000', 0.12),
    L(0, 4, 4, 0, '#000000', 0.12),
    L(0, 8, 8, 0, '#000000', 0.12),
    L(0, 16, 16, 0, '#000000', 0.12),
  ],
  Neon: [L(0, 0, 6, 0, '#00ffcc', 0.9), L(0, 0, 20, 2, '#00ffcc', 0.6), L(0, 0, 40, 6, '#00ffcc', 0.35)],
  'Hard offset': [L(6, 6, 0, 0, '#000000', 1)],
  Inset: [L(0, 2, 6, 0, '#000000', 0.35, true)],
};
export const newLayer = () => L(0, 4, 12, 0, '#000000', 0.25);
