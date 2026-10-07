// Flexbox playground state -> CSS/HTML. Pure functions, no DOM.
export const OPTIONS = {
  direction: ['row', 'row-reverse', 'column', 'column-reverse'],
  wrap: ['nowrap', 'wrap', 'wrap-reverse'],
  justify: ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'],
  alignItems: ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'],
  alignContent: ['normal', 'flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly', 'stretch'],
  alignSelf: ['auto', 'flex-start', 'center', 'flex-end', 'stretch', 'baseline'],
};
export const PROP = {
  direction: 'flex-direction',
  wrap: 'flex-wrap',
  justify: 'justify-content',
  alignItems: 'align-items',
  alignContent: 'align-content',
  gap: 'gap',
};
const CDEF = { direction: 'row', wrap: 'nowrap', justify: 'flex-start', alignItems: 'stretch', alignContent: 'normal', gap: 0 };
export const item = (label = '', o = {}) => ({ label, grow: 0, shrink: 1, basis: 'auto', order: 0, alignSelf: 'auto', ...o });
export const defaults = () => ({ ...CDEF, gap: 12, items: [item('One'), item('Two'), item('Three')] });

export const PRESETS = {
  centered: { name: 'Centered', make: () => ({ ...CDEF, justify: 'center', alignItems: 'center', items: [item('Centered')] }) },
  nav: { name: 'Nav bar', make: () => ({ ...CDEF, alignItems: 'center', gap: 16, items: [item('Logo'), item('Links', { grow: 1 }), item('Sign in')] }) },
  columns: { name: 'Equal columns', make: () => ({ ...CDEF, gap: 16, items: [1, 2, 3].map((n) => item(`Column ${n}`, { grow: 1, basis: '0' })) }) },
  footer: { name: 'Sticky footer', make: () => ({ ...CDEF, direction: 'column', items: [item('Header'), item('Content', { grow: 1 }), item('Footer')] }) },
  grail: {
    name: 'Holy grail',
    make: () => ({
      ...CDEF,
      wrap: 'wrap',
      gap: 8,
      items: [
        item('Header', { basis: '100%' }),
        item('Nav', { basis: '120px' }),
        item('Main', { grow: 1, basis: '0' }),
        item('Aside', { basis: '120px' }),
        item('Footer', { basis: '100%' }),
      ],
    }),
  },
};

const flexValue = (it) => {
  if (it.grow === 0 && it.shrink === 1 && it.basis === 'auto') return null;
  if (it.grow === 0 && it.shrink === 0 && it.basis === 'auto') return 'none';
  return `${it.grow} ${it.shrink} ${/^0+$/.test(String(it.basis)) ? '0%' : it.basis}`; // 0% because a unitless 0 basis is invalid in some old engines
};

/** Declarations for an item (only what differs from the defaults). */
export function itemDecls(it) {
  const d = [];
  const f = flexValue(it);
  if (f) d.push(['flex', f]);
  if (it.order) d.push(['order', String(it.order)]);
  if (it.alignSelf !== 'auto') d.push(['align-self', it.alignSelf]);
  return d;
}
export function containerDecls(s) {
  const d = [['display', 'flex']];
  for (const k of ['direction', 'wrap', 'justify', 'alignItems', 'alignContent']) if (s[k] !== CDEF[k]) d.push([PROP[k], s[k]]);
  if (s.gap) d.push(['gap', `${s.gap}px`]);
  return d;
}
/** A column container only has free space to grow into when it is given a height. */
const needsHeight = (s) => s.direction.startsWith('column') && (s.items.some((it) => it.grow > 0) || s.justify !== 'flex-start');
export function containerCss(s) {
  const d = containerDecls(s);
  return needsHeight(s) ? [...d, ['min-height', '100vh']] : d;
}

const block = (sel, decls) => `${sel} {\n${decls.map(([p, v]) => `  ${p}: ${v};`).join('\n')}\n}`;
export function css(s) {
  const out = [block('.container', containerCss(s))];
  s.items.forEach((it, i) => {
    const d = itemDecls(it);
    if (d.length) out.push(block(`.item-${i + 1}`, d));
  });
  return out.join('\n\n') + '\n';
}
const escHtml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export function html(s) {
  return `<div class="container">\n${s.items.map((it, i) => `  <div class="item item-${i + 1}">${escHtml(it.label || `Item ${i + 1}`)}</div>`).join('\n')}\n</div>\n`;
}

/** flex-basis values the builder accepts: auto, content, 0, or a non-negative length/percentage. */
export const validBasis = (v) => /^(auto|content|0|(\d+\.?\d*|\.\d+)(px|%|em|rem|vw|vh|ch))$/.test(String(v).trim());

const MAIN = (s) => (s.direction.startsWith('column') ? 'vertical' : 'horizontal');
export function hint(key, s) {
  const axis = MAIN(s),
    cross = axis === 'horizontal' ? 'vertical' : 'horizontal';
  const v = s[key];
  const H = {
    direction: {
      row: 'Items run left to right.',
      'row-reverse': 'Items run right to left; the first item ends up last.',
      column: 'Items stack top to bottom.',
      'column-reverse': 'Items stack bottom to top.',
    },
    wrap: {
      nowrap: 'All items stay on one line and shrink to fit.',
      wrap: 'Items move onto a new line when they run out of room.',
      'wrap-reverse': 'Items wrap onto new lines above (or before) the first.',
    },
    justify: {
      'flex-start': `Items pack at the start of the ${axis} axis.`,
      center: `Items gather in the middle of the ${axis} axis.`,
      'flex-end': `Items pack at the end of the ${axis} axis.`,
      'space-between': 'First and last items touch the edges; the rest of the space goes between items.',
      'space-around': 'Each item gets equal space on both sides, so the edges get half a gap.',
      'space-evenly': 'Every gap, including the edges, is the same size.',
    },
    alignItems: {
      stretch: `Items stretch to fill the ${cross} space.`,
      'flex-start': `Items line up at the start of the ${cross} axis.`,
      center: `Items are centred on the ${cross} axis.`,
      'flex-end': `Items line up at the end of the ${cross} axis.`,
      baseline: 'Items line up on the baseline of their first line of text.',
    },
    alignContent: {
      normal: 'Lines are packed as if stretched (the default).',
      stretch: 'Wrapped lines stretch to share the free space.',
      'flex-start': 'Wrapped lines pack at the start.',
      center: 'Wrapped lines gather in the middle.',
      'flex-end': 'Wrapped lines pack at the end.',
      'space-between': 'Space goes between wrapped lines.',
      'space-around': 'Equal space around each wrapped line.',
      'space-evenly': 'Equal space between and around wrapped lines.',
    },
  };
  let t = H[key]?.[v] ?? '';
  if (key === 'alignContent' && s.wrap === 'nowrap') t += ' Only has an effect when items wrap.';
  return t;
}
