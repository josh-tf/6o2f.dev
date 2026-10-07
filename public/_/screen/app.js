import { $, esc, mountBar } from '/_/ui.js';
import { aspect, bytes, toText, toJSON, mq, runFeatures } from './lib.js';
mountBar('This device');
const w = window,
  n = navigator,
  s = screen;
let storage = null,
  gl = null,
  groups = [],
  features = [];

function webgl() {
  try {
    const c = document.createElement('canvas'),
      ctx = c.getContext('webgl2') || c.getContext('webgl');
    if (!ctx) return { renderer: 'WebGL unavailable', vendor: '', max: '' };
    const ext = ctx.getExtension('WEBGL_debug_renderer_info');
    const r = {
      renderer: ctx.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : ctx.RENDERER),
      vendor: ctx.getParameter(ext ? ext.UNMASKED_VENDOR_WEBGL : ctx.VENDOR),
      max: ctx.getParameter(ctx.MAX_TEXTURE_SIZE),
    };
    ctx.getExtension('WEBGL_lose_context')?.loseContext();
    return r;
  } catch {
    return { renderer: 'blocked', vendor: '', max: '' };
  }
}
const yes = (b) => (b ? 'yes' : 'no');
const px = (a, b) => `${Math.round(a)} × ${Math.round(b)}`;
function collect() {
  const dpr = w.devicePixelRatio || 1,
    vv = w.visualViewport,
    o = s.orientation;
  const conn = n.connection,
    tz = Intl.DateTimeFormat().resolvedOptions();
  const pointer = mq(w, 'pointer', ['fine', 'coarse', 'none'], ''),
    anyPointer = mq(w, 'any-pointer', ['fine', 'coarse', 'none'], '');
  groups = [
    {
      title: 'Display',
      rows: [
        ['Screen', `${px(s.width, s.height)} CSS px`, 'The whole display in CSS pixels.'],
        ['Physical pixels', px(s.width * dpr, s.height * dpr), 'Screen × pixel ratio: the panel resolution (at 100% zoom).'],
        ['Available', px(s.availWidth, s.availHeight), 'Screen minus the taskbar or dock.'],
        [
          'Viewport',
          `${px(w.innerWidth, w.innerHeight)}${vv && vv.scale !== 1 ? ` (pinch zoom ${vv.scale.toFixed(2)}×)` : ''}`,
          'The page area inside this window, including scrollbars.',
        ],
        ['Aspect ratio', aspect(s.width, s.height), 'Screen width to height.'],
        ['Pixel ratio', String(+dpr.toFixed(3)), 'Device pixels per CSS pixel. Changes with browser zoom.'],
        ['Colour depth', `${s.colorDepth}-bit`, 'Bits per pixel; 24 is 8 bits per channel, 30 or more means 10-bit.'],
        ['Colour gamut', mq(w, 'color-gamut', ['rec2020', 'p3', 'srgb'], ''), 'Widest colour space the display covers: srgb, p3 (wide) or rec2020.'],
        ['HDR', mq(w, 'dynamic-range', ['high'], 'standard'), 'Whether the screen and browser can show high dynamic range.'],
        [
          'Orientation',
          o ? `${o.type.replace('-primary', '').replace('-secondary', ' (flipped)')}, ${o.angle}°` : w.innerWidth > w.innerHeight ? 'landscape' : 'portrait',
          'From screen.orientation.',
        ],
      ],
    },
    {
      title: 'Preferences',
      rows: [
        ['Colour scheme', mq(w, 'prefers-color-scheme', ['dark', 'light'], ''), 'Your system or browser light/dark setting.'],
        ['Reduced motion', mq(w, 'prefers-reduced-motion', ['reduce']), 'Asks sites to minimise animation.'],
        ['Contrast', mq(w, 'prefers-contrast', ['more', 'less', 'custom']), 'Asks for more or less contrast.'],
        ['Forced colours', mq(w, 'forced-colors', ['active'], 'none'), 'Windows High Contrast and similar modes that override page colours.'],
        ['Reduced transparency', mq(w, 'prefers-reduced-transparency', ['reduce']), 'Asks sites to avoid translucent layers.'],
        ['Reduced data', mq(w, 'prefers-reduced-data', ['reduce']), 'Data saver preference (few browsers support it).'],
      ],
    },
    {
      title: 'Input',
      rows: [
        ['Touch points', String(n.maxTouchPoints ?? 0), 'Simultaneous touches supported; 0 means no touchscreen.'],
        ['Primary pointer', pointer, 'fine = mouse or pen, coarse = finger, none = keyboard only.'],
        ['Any pointer', anyPointer, 'The most capable pointer attached.'],
        ['Hover', mq(w, 'hover', ['hover'], 'none'), 'Can the primary pointer hover?'],
        ['Any hover', mq(w, 'any-hover', ['hover'], 'none'), 'Can any attached pointer hover?'],
      ],
    },
    {
      title: 'Locale',
      rows: [
        ['Languages', (n.languages || [n.language]).join(', '), 'Accept-Language order, most preferred first.'],
        ['Time zone', tz.timeZone, 'IANA time zone name.'],
        [
          'UTC offset',
          (() => {
            const m = -new Date().getTimezoneOffset();
            return `UTC${m >= 0 ? '+' : '−'}${String(Math.floor(Math.abs(m) / 60)).padStart(2, '0')}:${String(Math.abs(m) % 60).padStart(2, '0')}`;
          })(),
          'Current offset including daylight saving.',
        ],
        ['Locale', tz.locale, 'Default for number and date formatting.'],
        [
          'Sample',
          new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date()) + ' · ' + (1234567.89).toLocaleString(),
          'How dates and numbers format here.',
        ],
      ],
    },
    {
      title: 'Hardware and network',
      rows: [
        ['CPU threads', String(n.hardwareConcurrency ?? ''), 'Logical processors the browser reports (may be capped).'],
        [
          'Device memory',
          n.deviceMemory ? `about ${n.deviceMemory} GB` : 'not exposed',
          'Rounded to a power of two and capped (8 GB, or 32 GB in newer Chromium) for privacy; Chromium only.',
        ],
        ['GPU', gl.renderer, 'WebGL renderer string (often the real GPU model).'],
        ['GPU vendor', gl.vendor, ''],
        ['Max texture', gl.max ? `${gl.max} px` : '', 'Largest WebGL texture side.'],
        ['Online', yes(n.onLine), 'Whether the browser thinks it has a network.'],
        [
          'Connection',
          conn ? `${conn.effectiveType ?? '?'}${conn.type ? `, ${conn.type}` : ''}` : 'not exposed',
          'Effective connection class (slow-2g to 4g), bucketed for privacy.',
        ],
        ['Downlink', conn?.downlink != null ? `${conn.downlink} Mbit/s` : '', 'Estimated bandwidth, rounded.'],
        ['Round trip', conn?.rtt != null ? `${conn.rtt} ms` : '', 'Estimated latency, rounded to 25 ms.'],
        ['Save-Data', conn ? yes(conn.saveData) : '', 'Data saver switched on.'],
        [
          'Storage quota',
          storage ? `${bytes(storage.usage)} used of ${bytes(storage.quota)}` : '',
          'What this site may store, from navigator.storage.estimate().',
        ],
        ['Secure context', yes(w.isSecureContext), 'HTTPS or localhost; many APIs need it.'],
        ['Cookies enabled', yes(n.cookieEnabled), ''],
      ],
    },
  ];
}
function render() {
  collect();
  $('#groups').innerHTML = groups
    .map(
      (g, i) =>
        `<section class="card" aria-labelledby="g${i}"><h2 id="g${i}">${esc(g.title)}</h2><table><caption class="vh">${esc(g.title)}</caption><tbody>${g.rows
          .map(
            ([k, v, why]) =>
              `<tr><th scope="row">${esc(k)}</th><td><span class="val">${v === '' || v == null ? '<span class="muted">unknown</span>' : esc(v)}</span>${why ? `<span class="why">${esc(why)}</span>` : ''}</td></tr>`,
          )
          .join('')}</tbody></table></section>`,
    )
    .join('');
}
function renderFeatures() {
  features = runFeatures(w);
  const ok = features.filter((f) => f.ok).length;
  $('#fsum').textContent = `${ok} of ${features.length} supported.`;
  $('#frows').innerHTML = features
    .map(
      (f) =>
        `<tr><th scope="row">${esc(f.name)}</th><td class="${f.ok ? 'y' : 'n'}"><span aria-hidden="true">${f.ok ? '✓' : '✕'}</span> ${f.ok ? 'Supported' : 'Not supported'}</td><td class="hide-s muted">${esc(f.note)}</td></tr>`,
    )
    .join('');
}

let raf = 0,
  liveT;
function schedule(why) {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    render();
    if (why) {
      $('#live').textContent = `Updated: ${why}`;
      clearTimeout(liveT);
      liveT = setTimeout(() => ($('#live').textContent = ''), 2000);
    }
  });
}
addEventListener('resize', () => schedule(''));
screen.orientation?.addEventListener('change', () => schedule('orientation changed'));
addEventListener('online', () => schedule('back online'));
addEventListener('offline', () => schedule('went offline'));
n.connection?.addEventListener?.('change', () => schedule('connection changed'));
for (const q of [
  '(prefers-color-scheme: dark)',
  '(prefers-reduced-motion: reduce)',
  '(prefers-contrast: more)',
  '(forced-colors: active)',
  '(resolution: 1dppx)',
  '(resolution: 2dppx)',
  '(pointer: coarse)',
  '(hover: hover)',
  '(dynamic-range: high)',
])
  matchMedia(q).addEventListener?.('change', () => schedule('a display or preference setting changed'));

let msgT;
async function copy(text, what) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(t);
    t.select();
    try {
      ok = document.execCommand('copy');
    } catch {}
    t.remove();
  }
  $('#msg').textContent = ok ? `Copied ${what}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  clearTimeout(msgT);
  msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
}
const plain = () => groups.map((g) => ({ title: g.title, rows: g.rows.map(([k, v]) => [k, v]) }));
$('#cpjson').addEventListener('click', () => copy(toJSON(plain(), features), 'JSON report'));
$('#cptext').addEventListener('click', () => copy(toText(plain(), features), 'text report'));

gl = webgl();
render();
renderFeatures();
n.storage
  ?.estimate?.()
  .then((e) => {
    storage = e;
    render();
  })
  .catch(() => {});
