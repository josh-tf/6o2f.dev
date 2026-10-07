// Modular type scale: size(step) = base * ratio^step. Optional fluid mode interpolates between a small-screen and a large-screen scale.
import { fluid } from '../clamp/lib.js';

export const RATIOS = [
  ['Minor second', 16 / 15],
  ['Major second', 9 / 8],
  ['Minor third', 6 / 5],
  ['Major third', 5 / 4],
  ['Perfect fourth', 4 / 3],
  ['Augmented fourth', Math.SQRT2],
  ['Perfect fifth', 3 / 2],
  ['Golden ratio', (1 + Math.sqrt(5)) / 2],
];
export const STACKS = {
  sans: 'system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif',
  serif: 'Charter, "Bitstream Charter", "Sitka Text", Cambria, Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, SFMono-Regular, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace',
  rounded:
    'ui-rounded, "Hiragino Maru Gothic ProN", Quicksand, Comfortaa, Manjari, "Arial Rounded MT", "Arial Rounded MT Bold", Calibri, source-sans-pro, sans-serif',
};
const r = (x, d = 4) => +x.toFixed(d);

/** Line height (unitless) for a size in px. rule: { mode: 'fixed', value } | { mode: 'gap', value: px added to the size, base },
 *  optional grid px to snap to. In gap mode sizes below `base` keep the base's ratio, so small print is not spaced out. */
export function lineHeight(px, rule) {
  const b = rule.base > 0 ? rule.base : 0;
  let lh = rule.mode !== 'gap' ? px * rule.value : px < b ? (px * (b + rule.value)) / b : px + rule.value;
  if (rule.grid > 0) lh = Math.max(rule.grid, Math.ceil(lh / rule.grid - 1e-9) * rule.grid);
  return r(lh / px, 3);
}

/** Steps from -down..up. o: { base, ratio, up, down, root, rule, fluid?: { base, ratio, minVw, maxVw } }.
 *  Returns [{ step, px, rem, lh, max?: px at the large viewport, clamp?: css }], largest first. */
export function scale(o) {
  const bad =
    !(o.base > 0 && o.ratio > 1 && o.root > 0) || (o.fluid && !(o.fluid.base > 0 && o.fluid.ratio > 1 && o.fluid.maxVw > o.fluid.minVw && o.fluid.minVw >= 0));
  if (bad) return null;
  const out = [];
  for (let s = Math.min(12, o.up); s >= -Math.min(6, o.down); s--) {
    const px = o.base * o.ratio ** s,
      row = { step: s, px: r(px, 2), rem: r(px / o.root), lh: lineHeight(px, o.rule) };
    if (o.fluid) {
      const max = o.fluid.base * o.fluid.ratio ** s;
      row.max = r(max, 2);
      row.lh = lineHeight(Math.max(px, max), { ...o.rule, base: Math.max(o.base, o.fluid.base) }); // ponytail: one unitless line height for the fluid range, sized for the larger end
      row.clamp = fluid({ min: px, max, minVw: o.fluid.minVw, maxVw: o.fluid.maxVw, unit: o.unit === 'px' ? 'px' : 'rem', root: o.root }).css;
    }
    out.push(row);
  }
  return out;
}
const value = (row, unit) => row.clamp ?? (unit === 'px' ? `${row.px}px` : `${row.rem}rem`);
const name = (s) => String(s); // step-0, step-1, step--1 (Utopia convention)

/** Output as css | tailwind | scss. */
export function format(rows, fmt, unit = 'rem', prefix = 'step') {
  const p =
    String(prefix)
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'step';
  if (fmt === 'css')
    return `:root {\n${rows.map((x) => `  --${p}-${name(x.step)}: ${value(x, unit)};`).join('\n')}\n${rows.map((x) => `  --${p}-${name(x.step)}-lh: ${x.lh};`).join('\n')}\n}`;
  if (fmt === 'scss') return `$${p}s: (\n${rows.map((x) => `  "${name(x.step)}": (font-size: ${value(x, unit)}, line-height: ${x.lh}),`).join('\n')}\n);`;
  if (fmt === 'tailwind')
    return `// tailwind.config.js\nmodule.exports = {\n  theme: {\n    extend: {\n      fontSize: {\n${rows.map((x) => `        '${p}-${name(x.step)}': ['${value(x, unit)}', { lineHeight: '${x.lh}' }],`).join('\n')}\n      },\n    },\n  },\n};`;
  throw new Error(`Unknown format ${fmt}`);
}
