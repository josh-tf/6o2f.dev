export const MAX_BYTES = 50 * 1024 * 1024,
  MAX_SIDE = 16384;
/** Target size. locked: fit inside the max box, keep ratio, never upscale. Unlocked: exact values (blank = original). */
export function fitSize(w, h, mw, mh, locked = true) {
  mw = +mw > 0 ? Math.round(+mw) : 0;
  mh = +mh > 0 ? Math.round(+mh) : 0;
  let r;
  if (!locked) r = [mw || w, mh || h];
  else {
    const k = Math.min(1, mw ? mw / w : 1, mh ? mh / h : 1);
    r = [Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k))];
  }
  return r.map((v) => Math.min(v, MAX_SIDE));
}
export function fmtBytes(n) {
  if (n < 1024) return n + ' B';
  return n < 1048576 ? (n / 1024).toFixed(1) + ' KB' : (n / 1048576).toFixed(2) + ' MB';
}
export const saved = (before, after) => {
  if (after === before) return 'same size';
  const p = Math.max(1, Math.min(99, Math.round(Math.abs(1 - after / before) * 100))); // never claim 0% or 100%
  return after < before ? `${p}% smaller` : after >= before * 2 ? `${+(after / before).toFixed(1)}× larger` : `${p}% larger`;
};
export const FORMATS = { png: ['image/png', 'png'], jpeg: ['image/jpeg', 'jpg'], webp: ['image/webp', 'webp'] };
