// Pure helpers for the "This device" report. Feature tests take a window-like object so they can run in node.

const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** 1920x1080 → "16:9"; near-standard ratios snap to their common names. */
export function aspect(w, h) {
  w = Math.round(w);
  h = Math.round(h);
  if (!(w > 0 && h > 0)) return '';
  const g = gcd(w, h),
    a = `${w / g}:${h / g}`;
  if (w / g <= 32 && h / g <= 32) return a;
  const r = Math.max(w, h) / Math.min(w, h),
    land = w >= h;
  const known = [
    [16 / 9, '16:9'],
    [16 / 10, '16:10'],
    [4 / 3, '4:3'],
    [3 / 2, '3:2'],
    [21 / 9, '21:9'],
    [19.5 / 9, '19.5:9'],
    [20 / 9, '20:9'],
    [5 / 4, '5:4'],
    [1, '1:1'],
  ];
  const hit = known.find(([k]) => Math.abs(k - r) / k < 0.02);
  const name = hit ? hit[1] : `${r.toFixed(2)}:1`;
  return land || !hit ? name : name.split(':').reverse().join(':');
}

/** 1536 → "1.5 KB", binary units (KiB values, labelled as people read them). */
export function bytes(n) {
  if (n == null || !Number.isFinite(n)) return '';
  const u = ['bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let i = 0;
  while (n >= 1024 && i < u.length - 1) {
    n /= 1024;
    i++;
  }
  return `${i ? n.toFixed(n < 10 ? 1 : 0) : n} ${u[i]}`;
}

/** Plain-text report from [{ title, rows: [[label, value]] }]. */
export function toText(groups, features = []) {
  const lines = [];
  for (const g of groups) {
    lines.push(`## ${g.title}`);
    const w = Math.max(...g.rows.map(([k]) => k.length));
    for (const [k, v] of g.rows) lines.push(`${k.padEnd(w)}  ${v === '' || v == null ? '-' : v}`);
    lines.push('');
  }
  if (features.length) {
    lines.push('## Features');
    const w = Math.max(...features.map((f) => f.name.length));
    for (const f of features) lines.push(`${f.name.padEnd(w)}  ${f.ok ? 'yes' : 'no'}`);
  }
  return lines.join('\n').trim() + '\n';
}
/** JSON report: { group: { label: value } , features: { name: bool } } */
export function toJSON(groups, features = []) {
  const o = {};
  for (const g of groups) o[g.title] = Object.fromEntries(g.rows.map(([k, v]) => [k, v]));
  if (features.length) o.Features = Object.fromEntries(features.map((f) => [f.name, f.ok]));
  return JSON.stringify(o, null, 2);
}

/** First matching media query value from a list, e.g. mq(w, 'prefers-contrast', ['more','less','custom']) → 'more' | 'no-preference'. */
export function mq(w, feature, values, fallback = 'no-preference') {
  if (!w.matchMedia) return '';
  for (const v of values) if (w.matchMedia(`(${feature}: ${v})`).matches) return v;
  return fallback && w.matchMedia(`(${feature}: ${fallback})`).matches ? fallback : 'not supported';
}

const has = (o, k) => {
  try {
    return !!o && k in o;
  } catch {
    return false;
  }
};
const css = (w, s) => {
  try {
    return !!w.CSS?.supports?.(s);
  } catch {
    return false;
  }
};
/** [name, test(window), note]. Tests only check that an API exists: nothing here asks for a permission. */
export const FEATURES = [
  [
    'WebGL',
    (w) => {
      try {
        const c = w.document.createElement('canvas');
        return !!(c.getContext('webgl') || c.getContext('experimental-webgl'));
      } catch {
        return false;
      }
    },
    '3D graphics (OpenGL ES 2).',
  ],
  [
    'WebGL 2',
    (w) => {
      try {
        return !!w.document.createElement('canvas').getContext('webgl2');
      } catch {
        return false;
      }
    },
    'OpenGL ES 3 level graphics.',
  ],
  ['WebGPU', (w) => has(w.navigator, 'gpu'), 'Modern GPU access and compute.'],
  ['WebAssembly', (w) => typeof w.WebAssembly === 'object', 'Near-native compiled code.'],
  ['WebRTC', (w) => typeof w.RTCPeerConnection === 'function', 'Peer-to-peer audio, video and data.'],
  ['WebTransport', (w) => typeof w.WebTransport === 'function', 'HTTP/3 streams and datagrams.'],
  ['WebCodecs', (w) => typeof w.VideoEncoder === 'function', 'Low-level audio/video encode and decode.'],
  ['Web Workers', (w) => typeof w.Worker === 'function', 'Background threads.'],
  [
    'SharedArrayBuffer',
    (w) => typeof w.SharedArrayBuffer === 'function' && !!w.crossOriginIsolated,
    'Shared memory between threads; needs cross-origin isolation.',
  ],
  ['OffscreenCanvas', (w) => typeof w.OffscreenCanvas === 'function', 'Canvas drawing in a worker.'],
  ['Service Worker', (w) => has(w.navigator, 'serviceWorker'), 'Offline caching and push; needs HTTPS.'],
  ['Push API', (w) => typeof w.PushManager === 'function', 'Server push notifications.'],
  ['Notifications', (w) => typeof w.Notification === 'function', 'System notifications (asks permission when used).'],
  ['Background Sync', (w) => typeof w.SyncManager === 'function', 'Retry work when back online.'],
  ['IndexedDB', (w) => has(w, 'indexedDB') && !!w.indexedDB, 'Large structured storage in the browser.'],
  ['Origin private file system', (w) => typeof w.navigator?.storage?.getDirectory === 'function', 'Fast private files for this site.'],
  ['File System Access', (w) => typeof w.showOpenFilePicker === 'function', 'Open and save real files in place.'],
  ['Async Clipboard', (w) => typeof w.navigator?.clipboard?.writeText === 'function', 'Copy and paste from script.'],
  ['Clipboard read', (w) => typeof w.navigator?.clipboard?.read === 'function', 'Read images and rich content from the clipboard.'],
  ['Web Share', (w) => typeof w.navigator?.share === 'function', 'The system share sheet.'],
  ['EyeDropper', (w) => typeof w.EyeDropper === 'function', 'Pick a colour from anywhere on screen.'],
  ['BarcodeDetector', (w) => typeof w.BarcodeDetector === 'function', 'Read QR and barcodes from images.'],
  ['WebAuthn / passkeys', (w) => typeof w.PublicKeyCredential === 'function', 'Passwordless sign-in.'],
  ['Payment Request', (w) => typeof w.PaymentRequest === 'function', 'Browser checkout sheet.'],
  ['Web Bluetooth', (w) => has(w.navigator, 'bluetooth'), 'Talk to Bluetooth LE devices.'],
  ['WebUSB', (w) => has(w.navigator, 'usb'), 'Talk to USB devices.'],
  ['Web Serial', (w) => has(w.navigator, 'serial'), 'Serial ports (Arduino and friends).'],
  ['WebHID', (w) => has(w.navigator, 'hid'), 'Game controllers and other HID devices.'],
  ['Web MIDI', (w) => typeof w.navigator?.requestMIDIAccess === 'function', 'Music instruments over MIDI.'],
  ['Web NFC', (w) => typeof w.NDEFReader === 'function', 'Read and write NFC tags.'],
  ['Gamepad', (w) => typeof w.navigator?.getGamepads === 'function', 'Game controllers.'],
  ['Geolocation', (w) => has(w.navigator, 'geolocation'), 'Location (asks permission when used).'],
  ['Screen Wake Lock', (w) => has(w.navigator, 'wakeLock'), 'Keep the screen on.'],
  ['Vibration', (w) => typeof w.navigator?.vibrate === 'function', 'Haptic feedback.'],
  ['Speech synthesis', (w) => has(w, 'speechSynthesis'), 'Text to speech.'],
  ['Speech recognition', (w) => typeof (w.SpeechRecognition || w.webkitSpeechRecognition) === 'function', 'Speech to text.'],
  ['Fullscreen', (w) => !!(w.document?.fullscreenEnabled || w.document?.webkitFullscreenEnabled), 'Fullscreen elements.'],
  ['Picture-in-Picture', (w) => !!w.document?.pictureInPictureEnabled, 'Floating video window.'],
  ['Window management', (w) => typeof w.getScreenDetails === 'function', 'Multi-screen placement.'],
  ['Local fonts', (w) => typeof w.queryLocalFonts === 'function', 'List installed fonts.'],
  ['Compression Streams', (w) => typeof w.CompressionStream === 'function', 'gzip and deflate in the browser.'],
  ['View Transitions', (w) => typeof w.document?.startViewTransition === 'function', 'Animated page and state transitions.'],
  ['Popover', (w) => has(w.HTMLElement?.prototype, 'popover'), 'Native popovers and menus.'],
  ['CSS :has()', (w) => css(w, 'selector(:has(a))'), 'Parent selector.'],
  ['CSS container queries', (w) => css(w, 'container-type: inline-size'), 'Style by container size.'],
  ['CSS nesting', (w) => css(w, 'selector(&)'), 'Nested rules without a preprocessor.'],
  ['CSS anchor positioning', (w) => css(w, 'anchor-name: --a'), 'Position popovers relative to elements.'],
];
export const runFeatures = (w) =>
  FEATURES.map(([name, test, note]) => {
    let ok = false;
    try {
      ok = !!test(w);
    } catch {}
    return { name, ok, note };
  });
