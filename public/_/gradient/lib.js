// Pure CSS gradient string builder. stops: [{color:'#rrggbb', pos:0-100}]
const n = (v, d) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : d);
export function gradientCss({ type = 'linear', angle = 90, shape = 'circle', x = 50, y = 50, stops }) {
  const list = stops.map((s) => `${s.color} ${n(s.pos, 0)}%`).join(', ');
  const at = `${n(x, 50)}% ${n(y, 50)}%`;
  if (type === 'radial') return `radial-gradient(${shape} at ${at}, ${list})`;
  if (type === 'conic') return `conic-gradient(from ${n(angle, 0)}deg at ${at}, ${list})`;
  return `linear-gradient(${n(angle, 180)}deg, ${list})`;
}
export const backgroundCss = (g) => `background: ${gradientCss(g)};`;
export function randomGradient(rand = Math.random) {
  const k = 2 + Math.floor(rand() * 3),
    type = ['linear', 'radial', 'conic'][Math.floor(rand() * 3)];
  const h = Math.floor(rand() * 360);
  const col = (i) => hslHex((h + i * (40 + rand() * 60)) % 360, 65 + rand() * 25, 45 + rand() * 20);
  return {
    type,
    angle: Math.floor(rand() * 360),
    shape: 'circle',
    x: 50,
    y: 50,
    stops: Array.from({ length: k }, (_, i) => ({ color: col(i), pos: Math.round((i * 100) / (k - 1)) })),
  };
}
export function hslHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (k) => {
    const m = (k + h / 30) % 12;
    return l - a * Math.max(-1, Math.min(m - 3, 9 - m, 1));
  };
  return (
    '#' +
    [f(0), f(8), f(4)]
      .map((v) =>
        Math.round(v * 255)
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}
export const PRESETS = {
  Sunset: {
    type: 'linear',
    angle: 135,
    stops: [
      { color: '#ff512f', pos: 0 },
      { color: '#f09819', pos: 50 },
      { color: '#dd2476', pos: 100 },
    ],
  },
  Ocean: {
    type: 'linear',
    angle: 180,
    stops: [
      { color: '#2193b0', pos: 0 },
      { color: '#6dd5ed', pos: 100 },
    ],
  },
  Aurora: {
    type: 'linear',
    angle: 60,
    stops: [
      { color: '#00c9ff', pos: 0 },
      { color: '#92fe9d', pos: 55 },
      { color: '#7b2ff7', pos: 100 },
    ],
  },
  Spotlight: {
    type: 'radial',
    shape: 'circle',
    x: 30,
    y: 30,
    stops: [
      { color: '#fdfbfb', pos: 0 },
      { color: '#4b6cb7', pos: 70 },
      { color: '#182848', pos: 100 },
    ],
  },
  Wheel: {
    type: 'conic',
    angle: 0,
    stops: [
      { color: '#ff0000', pos: 0 },
      { color: '#ffff00', pos: 17 },
      { color: '#00ff00', pos: 33 },
      { color: '#00ffff', pos: 50 },
      { color: '#0000ff', pos: 67 },
      { color: '#ff00ff', pos: 83 },
      { color: '#ff0000', pos: 100 },
    ],
  },
  Mono: {
    type: 'linear',
    angle: 90,
    stops: [
      { color: '#111111', pos: 0 },
      { color: '#eeeeee', pos: 100 },
    ],
  },
};
