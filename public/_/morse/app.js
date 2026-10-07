import { $, esc, mountBar } from '/_/ui.js';
import { MORSE, PROSIGNS, encode, decode, looksLikeMorse, timing, segments, totalMs, pcm, wav, decodeTaps } from './lib.js';
mountBar('Morse');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduce) {
  $('#lite').disabled = true;
  $('#lite').checked = false;
  $('#rm').hidden = false;
}
$('#ref').innerHTML = [...Object.entries(MORSE), ...['AR', 'SK', 'SOS', 'HH'].map((k) => [`<${k}>`, PROSIGNS[k]])]
  .map(([k, v]) => `<span><b>${esc(k)}</b> <code>${v}</code></span>`)
  .join('');

let msgT;
const say = (m) => {
  $('#msg').textContent = m;
  clearTimeout(msgT);
  msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
};
async function copy(text) {
  if (!text) return say('Nothing to copy.');
  try {
    await navigator.clipboard.writeText(text);
    say('Copied.');
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    say(ok ? 'Copied.' : 'Copy blocked by the browser. Select the text and press Ctrl+C.');
  }
}

// --- translate: whichever box you edit last drives the other
function fromText() {
  const { morse, unknown } = encode($('#text').value);
  $('#morse').value = morse;
  $('#err').textContent = unknown.length ? `No Morse code for: ${unknown.join(' ')} (skipped).` : '';
  refresh();
}
function fromMorse() {
  const m = $('#morse').value;
  if (m.trim() && !looksLikeMorse(m)) {
    $('#err').textContent = 'Morse can only contain dots (.), dashes (-), spaces and /.';
    return;
  }
  const { text, bad } = decode(m);
  $('#text').value = text;
  $('#err').textContent = bad ? `${bad} group${bad > 1 ? 's are' : ' is'} not valid Morse and shown as ?.` : '';
  refresh();
}
$('#text').addEventListener('input', fromText);
$('#morse').addEventListener('input', fromMorse);
$('#cm').addEventListener('click', () => copy($('#morse').value));
$('#ct').addEventListener('click', () => copy($('#text').value));

// --- timing
const num = (id, lo, hi, d) => {
  const v = Number($(id).value);
  return Number.isFinite(v) && v >= lo && v <= hi ? v : d;
};
const settings = () => {
  const wpm = num('#wpm', 5, 40, 18),
    c = Math.max(wpm, num('#fw', 5, 40, wpm));
  return { wpm, c, freq: num('#freq', 200, 1200, 600), vol: num('#vol', 0, 100, 50) / 100 };
};
function refresh() {
  const s = settings(),
    t = timing(s.wpm, s.c),
    segs = segments($('#morse').value, s.wpm, s.c);
  $('#timing').textContent =
    `Dot ${t.unit.toFixed(0)} ms, dash ${(3 * t.unit).toFixed(0)} ms, letter gap ${(3 * t.gapUnit).toFixed(0)} ms, word gap ${(7 * t.gapUnit).toFixed(0)} ms. Message length ${(totalMs(segs) / 1000).toFixed(1)} s.`;
  $('#play').disabled = $('#dl').disabled = !segs.length;
  tapRender();
}
for (const id of ['#wpm', '#fw', '#freq']) $(id).addEventListener('input', refresh);
$('#wpm').addEventListener('change', () => {
  if (Number($('#fw').value) < Number($('#wpm').value)) {
    $('#fw').value = $('#wpm').value;
    refresh();
  }
});

// --- play
const MAX_MS = 30 * 60000; // ponytail: audio is rendered up front, so cap it (30 min at 22 kHz is ~160 MB of samples)
const tooLong = (segs) => {
  if (totalMs(segs) <= MAX_MS) return false;
  $('#pstat').textContent = 'That message is over 30 minutes long at this speed. Shorten it or raise the WPM to play or download it.';
  return true;
};
let ctx, src, raf, gain;
function stop(msg = '') {
  cancelAnimationFrame(raf);
  try {
    src?.stop();
  } catch {}
  src = null;
  $('#lamp').classList.remove('on');
  $('#stop').disabled = true;
  $('#play').disabled = !$('#morse').value.trim();
  $('#pstat').textContent = msg;
}
$('#play').addEventListener('click', async () => {
  const s = settings(),
    segs = segments($('#morse').value, s.wpm, s.c);
  if (!segs.length) return;
  stop();
  if (tooLong(segs)) return;
  try {
    ctx ??= new AudioContext();
    await ctx.resume();
    const rate = ctx.sampleRate > 48000 ? 44100 : ctx.sampleRate,
      data = pcm(segs, { freq: s.freq, vol: 1, rate });
    const buf = ctx.createBuffer(1, data.length, rate);
    buf.copyToChannel(data, 0);
    gain = ctx.createGain();
    gain.gain.value = $('#snd').checked ? s.vol : 0;
    gain.connect(ctx.destination);
    src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(gain);
    const t0 = ctx.currentTime + 0.05;
    src.start(t0);
    $('#stop').disabled = false;
    $('#play').disabled = true;
    $('#pstat').textContent = 'Playing';
    const ends = [];
    let acc = 0;
    for (const g of segs) {
      ends.push([acc, acc + g.ms, g.on]);
      acc += g.ms;
    }
    const tick = () => {
      const ms = (ctx.currentTime - t0) * 1000;
      if (ms >= acc) return stop('Done');
      $('#lamp').classList.toggle('on', $('#lite').checked && ends.some(([a, b, on]) => on && ms >= a && ms < b));
      gain.gain.value = $('#snd').checked ? Number($('#vol').value) / 100 : 0;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  } catch (e) {
    stop();
    $('#pstat').textContent = 'Audio could not start in this browser.';
  }
});
$('#stop').addEventListener('click', () => stop('Stopped'));
$('#dl').addEventListener('click', () => {
  const s = settings(),
    segs = segments($('#morse').value, s.wpm, s.c);
  if (!segs.length || tooLong(segs)) return;
  const url = URL.createObjectURL(new Blob([wav(pcm(segs, { freq: s.freq, vol: s.vol }), 22050)], { type: 'audio/wav' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: 'morse.wav' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

// --- tap key
let presses = [],
  downAt = 0;
function tapRender() {
  const u = timing(settings().wpm).unit,
    r = decodeTaps(presses, u);
  $('#tmorse').textContent = r.morse || 'Nothing yet.';
  $('#ttext').textContent = r.text || '';
}
const keyDown = () => {
  if (!downAt) {
    downAt = performance.now();
    $('#key').classList.add('down');
  }
};
const keyUp = () => {
  if (!downAt) return;
  presses.push({ down: downAt, up: performance.now() });
  downAt = 0;
  $('#key').classList.remove('down');
  tapRender();
};
const key = $('#key');
key.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  key.setPointerCapture?.(e.pointerId);
  key.focus();
  keyDown();
});
key.addEventListener('pointerup', keyUp);
key.addEventListener('pointercancel', keyUp);
key.addEventListener('keydown', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    if (!e.repeat) keyDown();
  }
});
key.addEventListener('keyup', (e) => {
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault();
    keyUp();
  }
});
key.addEventListener('blur', keyUp);
$('#tclear').addEventListener('click', () => {
  presses = [];
  tapRender();
});

fromText();
