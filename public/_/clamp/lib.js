// Fluid size = linear interpolation between (minVw, min) and (maxVw, max), clamped outside that range.
const n = (x) => +x.toFixed(4);

/** Returns { slope (px per px of viewport), intercept (px), css } or null when the inputs are unusable. */
export function fluid({ min, max, minVw, maxVw, unit = 'rem', root = 16 }) {
  if (![min, max, minVw, maxVw].every(Number.isFinite) || maxVw <= minVw || min < 0 || max < 0 || minVw < 0) return null;
  const slope = (max - min) / (maxVw - minVw),
    intercept = min - slope * minVw,
    k = unit === 'rem' ? 1 / root : 1;
  const len = (px) => n(px * k) + unit;
  const expr = `${len(intercept)} ${slope < 0 ? '-' : '+'} ${n(Math.abs(slope) * 100)}vw`;
  // CSS clamp(MIN, VAL, MAX) needs MIN <= MAX, so a shrinking size swaps the bounds.
  return { slope, intercept, css: `clamp(${len(Math.min(min, max))}, calc(${expr}), ${len(Math.max(min, max))})` };
}

/** Computed size in px at viewport width w (px). */
export const sizeAt = (p, w) => {
  const { slope, intercept } = fluid(p);
  return Math.min(Math.max(p.min, p.max), Math.max(Math.min(p.min, p.max), intercept + slope * w));
};
