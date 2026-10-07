// Pure counting helpers: used by app.js and tested in src/tools/count/lib.test.ts.
const hasSeg = typeof Intl !== 'undefined' && Intl.Segmenter;
const gSeg = hasSeg && new Intl.Segmenter(undefined, { granularity: 'grapheme' });
const wSeg = hasSeg && new Intl.Segmenter(undefined, { granularity: 'word' });

export const graphemes = (s) => (gSeg ? [...gSeg.segment(s)].map((x) => x.segment) : [...s]);
export const wordList = (s) =>
  wSeg ? [...wSeg.segment(s)].filter((x) => x.isWordLike).map((x) => x.segment) : (s.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []);

export const STOP = new Set(
  'a an and are as at be been but by can did do does for from had has have he her his i if in into is it its me my no not of on or our she so than that the their them then there these they this to up us was we were what when which who will with would you your'.split(
    ' ',
  ),
);

export function count(text) {
  const g = graphemes(text),
    w = wordList(text);
  return {
    words: w.length,
    chars: g.length,
    charsNoSpace: g.filter((c) => /\S/.test(c)).length,
    lines: text ? text.replace(/(\r\n|\r|\n)$/, '').split(/\r\n|\r|\n/).length : 0,
    sentences: text.split(/[.!?…]+(?:\s+|$)/).filter((x) => /[\p{L}\p{N}]/u.test(x)).length, // ponytail: "e.g. x" counts as two; needs an abbreviation list to fix
    paragraphs: text.split(/\r?\n\s*\r?\n/).filter((x) => x.trim()).length,
    bytes: new TextEncoder().encode(text).length,
  };
}

/** "45 sec", "2 min 5 sec" */
export const duration = (words, wpm) => {
  const s = Math.round((words / wpm) * 60);
  return s < 60 ? `${s} sec` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} sec` : ''}`;
};

/** Top-n words, case-insensitive; ties keep first-seen order. */
export function topWords(text, stop, n = 10) {
  const m = new Map();
  for (const x of wordList(text)) {
    const k = x.toLowerCase();
    if (!(stop && STOP.has(k))) m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
}
