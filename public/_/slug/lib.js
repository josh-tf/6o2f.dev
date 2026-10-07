// Pure slug helpers: used by app.js and tested in src/tools/slug/lib.test.ts.
const MAP = {
  ß: 'ss',
  æ: 'ae',
  Æ: 'AE',
  ø: 'o',
  Ø: 'O',
  ł: 'l',
  Ł: 'L',
  œ: 'oe',
  Œ: 'OE',
  ð: 'd',
  Ð: 'D',
  þ: 'th',
  Þ: 'Th',
  đ: 'd',
  Đ: 'D',
  ı: 'i',
  ħ: 'h',
  ẞ: 'SS',
  '&': ' and ',
};
export const STOP = new Set('a an and are as at be but by for from in into is it of on or the to with'.split(' '));

/** opts: sep ('-'|'_'|'.'|''), lower, max (0 = no limit), accents (strip via NFD), stop (drop stop words). */
export function slugify(s, { sep = '-', lower = true, max = 0, accents = true, stop = false } = {}) {
  s = s.replace(/[ßæÆøØłŁœŒðÐþÞđĐıħẞ&]/g, (c) => MAP[c]);
  if (accents) s = s.normalize('NFD').replace(/\p{M}+/gu, '');
  s = s.replace(/['’]/g, ''); // don't -> dont
  let w = accents ? (s.match(/[A-Za-z0-9]+/g) ?? []) : (s.normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? []);
  if (lower) w = w.map((x) => x.toLowerCase());
  if (stop) {
    const k = w.filter((x) => !STOP.has(x.toLowerCase()));
    if (k.length) w = k;
  } // never strip a title down to nothing
  if (max > 0) {
    let out = [],
      len = 0;
    for (const x of w) {
      const add = len + (out.length ? sep.length : 0) + x.length;
      if (add > max) break;
      out.push(x);
      len = add;
    }
    if (!out.length && w.length) out = [w[0].slice(0, max)]; // one word longer than max: hard cut
    w = out;
  }
  return w.join(sep);
}
