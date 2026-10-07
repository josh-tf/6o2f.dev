import { $, esc, mountBar } from '/_/ui.js';
import { COMMON, describe, keyLabel, snippets } from './lib.js';
mountBar('Key codes');

const cap = $('#cap'),
  hist = [];
// Keys the page lets through: Tab keeps keyboard navigation working, the rest are reload/devtools/fullscreen.
const passThrough = (e) => e.key === 'Tab' || ['F5', 'F11', 'F12'].includes(e.key) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r');

function show(e) {
  const d = describe(e);
  $('#big').textContent = d.label;
  $('#big').classList.toggle('long', d.label.length > 3);
  $('#sc').textContent = d.shortcut.includes('+') ? d.shortcut : ''; // only when a modifier is part of it
  $('#virt').hidden = !d.virtual;
  if (d.virtual) $('#typed').textContent = '';
  const rows = [
    ['event.key', JSON.stringify(d.key)],
    ['event.code', d.code],
    ['event.keyCode', d.keyCode],
    ['event.which', d.which],
    ['event.location', `${d.location} (${d.locationName})`],
    ['Modifiers', d.modifiers.join(' + ') || 'none'],
    ['event.repeat', d.repeat],
    ['event.isComposing', d.composing],
    ['CapsLock', e.getModifierState?.('CapsLock') ? 'on' : 'off'],
    ['AltGraph', e.getModifierState?.('AltGraph') ? 'held' : 'no'],
  ];
  $('#props').innerHTML = rows.map(([k, v]) => `<div><dt><code>${esc(k)}</code></dt><dd>${esc(v)}</dd></div>`).join('');
  const s = snippets(e);
  $('#snkey').textContent = s.key;
  $('#sncode').textContent = s.code;
}

function log(e) {
  if (e.type === 'keyup' && !$('#ups').checked) return;
  const d = describe(e);
  hist.unshift({ type: e.type, ...d });
  hist.length = Math.min(hist.length, 30);
  draw();
}
function draw() {
  $('#hist').innerHTML = hist.length
    ? hist
        .map(
          (h) =>
            `<tr><td>${h.type === 'keyup' ? 'up' : h.repeat ? 'repeat' : 'down'}</td><td class="mono">${esc(keyLabel(h.key))}</td><td class="mono">${esc(h.code)}</td><td class="mono">${h.keyCode}</td><td>${esc(h.locationName)}</td><td>${esc(h.modifiers.join('+'))}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="6" class="muted">No keys yet.</td></tr>';
}

cap.addEventListener('keydown', (e) => {
  if (!passThrough(e) && !(e.key === 'Unidentified' || e.keyCode === 229)) e.preventDefault(); // virtual keyboards need the default to deliver text
  show(e);
  log(e);
});
cap.addEventListener('keyup', log);
cap.addEventListener('input', (e) => {
  $('#typed').textContent = e.data ?? '';
  cap.value = '';
});
$('#clear').addEventListener('click', () => {
  hist.length = 0;
  draw();
  cap.focus();
});
$('#ups').addEventListener('change', () => cap.focus());

document.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-copy]');
  if (!b) return;
  const t = $('#' + b.dataset.copy).textContent;
  try {
    await navigator.clipboard.writeText(t);
    $('#msg').textContent = 'Copied.';
  } catch {
    $('#msg').textContent = 'Copy failed; select the text instead.';
  }
});

$('#ref').innerHTML = COMMON.map(
  ([k, c, kc]) => `<tr><td class="mono">${esc(keyLabel(k))}</td><td class="mono">${esc(c)}</td><td class="mono">${kc}</td></tr>`,
).join('');
// Example on first view, so the page isn't empty before a key is pressed.
// Plain values, not a synthetic KeyboardEvent: those always report keyCode/which 0.
show({ key: 'Enter', code: 'Enter', keyCode: 13, which: 13, location: 0, getModifierState: () => false });
if (matchMedia('(pointer:fine)').matches) cap.focus();
