import { $, esc, mountBar } from '/_/ui.js';
import { matrix, wifi } from '/_/qr/lib.js';
import { classify, decodePixels } from './lib.js';
mountBar('QR reader');

const hist = [];
let current = null,
  stream = null,
  raf = 0,
  lastTick = 0,
  busy = false,
  msgT,
  jsQR = null,
  detector;

// BarcodeDetector where the platform has a QR decoder (Android, ChromeOS, macOS); jsQR otherwise.
async function getDetector() {
  if (detector !== undefined) return detector;
  try {
    detector =
      'BarcodeDetector' in window && (await BarcodeDetector.getSupportedFormats()).includes('qr_code') ? new BarcodeDetector({ formats: ['qr_code'] }) : null;
  } catch {
    detector = null;
  }
  $('#engine').textContent = detector ? 'Decoder: built-in' : 'Decoder: jsQR';
  return detector;
}
async function decode(canvas) {
  const det = await getDetector();
  if (det) {
    try {
      const r = await det.detect(canvas);
      if (r.length) return r[0].rawValue;
    } catch {}
  }
  jsQR ??= (await import('./vendor/jsqr.min.js')).default;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return decodePixels(jsQR, ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);
}
/** Draw a source into the visible canvas (max 1200px), decode, and if nothing is found retry smaller (helps with large photos). */
async function scanImage(src, label) {
  const cv = $('#shot'),
    s = Math.min(1, 1200 / Math.max(src.width, src.height));
  cv.width = Math.max(1, Math.round(src.width * s));
  cv.height = Math.max(1, Math.round(src.height * s));
  cv.getContext('2d', { willReadFrequently: true }).drawImage(src, 0, 0, cv.width, cv.height);
  $('#video').hidden = true;
  cv.hidden = false;
  $('#state').textContent = `Scanning ${label}…`;
  let text = await decode(cv);
  if (text == null && Math.max(cv.width, cv.height) > 500) {
    const small = document.createElement('canvas'),
      k = 500 / Math.max(cv.width, cv.height);
    small.width = Math.round(cv.width * k);
    small.height = Math.round(cv.height * k);
    small.getContext('2d', { willReadFrequently: true }).drawImage(cv, 0, 0, small.width, small.height);
    text = await decode(small);
  }
  if (text == null) {
    $('#state').textContent = '';
    $('#err').textContent = `No QR code found in ${label}. Try a sharper, straighter photo with the whole code in view.`;
    return;
  }
  $('#err').textContent = '';
  found(text, label);
}
async function loadFile(file) {
  if (!file) return;
  stopCam();
  if (!file.type.startsWith('image/')) {
    $('#err').textContent = `"${file.name}" is not an image.`;
    return;
  }
  try {
    await scanImage(await createImageBitmap(file), `"${file.name || 'pasted image'}"`);
  } catch {
    $('#err').textContent = `Could not open "${file.name}". Try a PNG, JPEG, WebP or GIF.`;
    $('#state').textContent = '';
  }
}

function found(text, source) {
  const item = { text, source, at: new Date(), info: classify(text) };
  if (!(hist[0] && hist[0].text === text)) hist.unshift(item);
  if (hist.length > 50) hist.pop();
  $('#state').textContent = `Found a ${item.info.label.toLowerCase()} in ${source}.`;
  show(item);
  renderHist();
}
function show(item) {
  current = item;
  const { info, text } = item;
  const rows = info.fields.map(([k, v]) => `<tr><th scope="row">${esc(k)}</th><td>${esc(v)}</td></tr>`).join('');
  let open = '';
  if (info.href) {
    const u = info.href,
      warn = [];
    try {
      const p = new URL(u);
      if (p.username || p.password) warn.push('it contains a user name or password before the host, a common trick to disguise where it goes');
      if (/(^|\.)xn--/.test(p.hostname)) warn.push('the host uses international characters (punycode), which can imitate another site');
    } catch {}
    open = `<div class="qs-open"><p>This opens:</p><p><code class="qs-url">${esc(u)}</code></p>${warn.length ? `<p class="err">Careful: ${esc(warn.join('; '))}.</p>` : ''}
      <a class="btn" href="${esc(u)}" target="_blank" rel="noopener noreferrer">Open ${info.type === 'email' ? 'in mail app' : info.type === 'tel' ? 'in phone app' : info.type === 'sms' ? 'in messages' : info.type === 'geo' ? 'map' : 'link'}</a></div>`;
  }
  $('#result').innerHTML = `<p class="qs-type"><span class="qs-badge">${esc(info.label)}</span> <span class="muted">${esc(item.source)}</span></p>
    ${rows ? `<table><caption class="vh">Decoded fields</caption><tbody>${rows}</tbody></table>` : ''}
    <p class="lbl">Raw text (${[...text].length} characters)</p><pre class="qs-raw"></pre>${open}`;
  $('#result .qs-raw').textContent = text;
  $('#copy').disabled = false;
}
function renderHist() {
  $('#clear').disabled = !hist.length;
  $('#hist').innerHTML = hist.length
    ? hist
        .map(
          (h, i) =>
            `<li><button type="button" data-i="${i}"><span class="qs-badge">${esc(h.info.label)}</span> <span class="qs-ht">${esc(h.text.length > 80 ? h.text.slice(0, 80) + '…' : h.text)}</span> <time class="muted" datetime="${h.at.toISOString()}">${h.at.toLocaleTimeString()}</time></button></li>`,
        )
        .join('')
    : '<li class="muted">No scans yet.</li>';
}

// Camera
async function startCam() {
  $('#err').textContent = '';
  if (!navigator.mediaDevices?.getUserMedia) {
    $('#err').textContent = window.isSecureContext
      ? 'This browser cannot use the camera. Upload a photo of the code instead.'
      : 'The camera only works over HTTPS. Upload a photo of the code instead.';
    return;
  }
  try {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (e) {
      if (e.name !== 'OverconstrainedError') throw e;
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    }
  } catch (e) {
    stream = null;
    $('#err').textContent =
      {
        NotAllowedError: "Camera access was refused. Allow it in your browser's site settings, or upload a photo instead.",
        NotFoundError: 'No camera was found. Upload a photo of the code instead.',
        NotReadableError: 'The camera is busy in another app. Close it and try again.',
        SecurityError: 'Camera access is blocked on this page. Upload a photo instead.',
      }[e.name] ?? `Could not start the camera (${e.message || e.name}).`;
    return;
  }
  const v = $('#video');
  v.srcObject = stream;
  v.hidden = false;
  $('#shot').hidden = true;
  try {
    await v.play();
  } catch {}
  $('#cam').textContent = 'Stop camera';
  $('#cam').setAttribute('aria-pressed', 'true');
  $('#state').textContent = 'Camera on. Point it at a QR code.';
  raf = requestAnimationFrame(tick);
}
async function tick(t) {
  if (!stream) return;
  raf = requestAnimationFrame(tick);
  const v = $('#video');
  if (busy || t - lastTick < 200 || v.readyState < 2 || !v.videoWidth) return;
  lastTick = t;
  busy = true;
  try {
    const c = document.createElement('canvas'),
      s = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
    c.width = Math.round(v.videoWidth * s);
    c.height = Math.round(v.videoHeight * s);
    c.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, 0, c.width, c.height);
    const text = await decode(c);
    if (text != null && stream) {
      const cv = $('#shot');
      cv.width = c.width;
      cv.height = c.height;
      cv.getContext('2d').drawImage(c, 0, 0);
      stopCam();
      found(text, 'the camera');
    }
  } finally {
    busy = false;
  }
}
function stopCam() {
  cancelAnimationFrame(raf);
  if (!stream) return;
  stream.getTracks().forEach((t) => t.stop());
  stream = null;
  const v = $('#video');
  v.srcObject = null;
  v.hidden = true;
  $('#shot').hidden = false;
  $('#cam').textContent = 'Start camera';
  $('#cam').setAttribute('aria-pressed', 'false');
  $('#state').textContent = 'Camera off.';
}

$('#cam').addEventListener('click', () => (stream ? stopCam() : startCam()));
document.addEventListener('visibilitychange', () => document.hidden && stopCam());
$('#file').addEventListener('change', (e) => {
  loadFile(e.target.files[0]);
  e.target.value = '';
});
const drop = $('#drop');
drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  drop.classList.add('over');
});
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault();
  drop.classList.remove('over');
  loadFile(e.dataTransfer.files[0]);
});
document.addEventListener('paste', (e) => {
  const f = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
  if (f) {
    e.preventDefault();
    loadFile(f);
  }
});
$('#copy').addEventListener('click', async () => {
  if (!current) return;
  const say = (t) => {
    $('#msg').textContent = t;
    clearTimeout(msgT);
    msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
  };
  try {
    await navigator.clipboard.writeText(current.text);
    say('Copied.');
  } catch {
    const r = document.createRange();
    r.selectNodeContents($('#result .qs-raw'));
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    say(document.execCommand?.('copy') ? 'Copied.' : 'Copy blocked by the browser. The text is selected, press Ctrl+C.');
  }
});
$('#hist').addEventListener('click', (e) => {
  const b = e.target.closest('[data-i]');
  if (b) show(hist[+b.dataset.i]);
});
$('#clear').addEventListener('click', () => {
  hist.length = 0;
  renderHist();
});

// First view: decode a sample Wi-Fi code drawn with the QR tool's encoder, so the page shows a real result.
(async () => {
  renderHist();
  const m = matrix(wifi({ ssid: 'Cafe Guest', pass: 'flat white 4 me', sec: 'WPA' }), 'M'),
    q = 4,
    px = 6,
    n = m.length + q * 2;
  const c = Object.assign(document.createElement('canvas'), { width: n * px, height: n * px }),
    x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = '#000';
  m.forEach((row, r) => row.forEach((on, k) => on && x.fillRect((k + q) * px, (r + q) * px, px, px)));
  await scanImage(c, 'the sample code');
})();
