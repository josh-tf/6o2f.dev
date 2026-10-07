import { $, api, mountBar } from '/_/ui.js';
import { spoken, when, zonedToUtc } from './lib.js';
import { drawClock, everySecond } from './clock.js';
mountBar('Countdown');

const myTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
const zones = (() => {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return [myTz, 'UTC'];
  }
})();
if (!zones.includes(myTz)) zones.unshift(myTz);
if (!zones.includes('UTC')) zones.push('UTC');
$('#tz').append(...zones.map((z) => new Option(z.replace(/_/g, ' ') + (z === myTz ? ' (yours)' : ''), z)));
$('#tz').value = myTz;
// Example: next New Year in the viewer's zone.
const ny = new Date().getFullYear() + 1;
$('#title').value = `New Year ${ny}`;
$('#at').value = `${ny}-01-01T00:00`;
$('#msg').value = `Happy New Year! Here's to ${ny}.`;

const link = (id) => `${location.origin}/c/${id}`;
const target = () => zonedToUtc($('#at').value, $('#tz').value);
let confirming = null;

function preview() {
  const t = target();
  $('#pvtitle').textContent = $('#title').value.trim() || 'Untitled';
  if (!Number.isFinite(t)) {
    drawClock($('#pv'), 0);
    $('#pvspoken').textContent = 'Pick a date and time.';
    $('#pvwhen').textContent = '';
    return;
  }
  const ms = t - Date.now();
  drawClock($('#pv'), ms);
  $('#pvspoken').textContent = ms > 0 ? `${spoken(ms)} to go` : 'That time has passed: pick a future date.';
  $('#pvwhen').textContent = $('#tz').value === myTz ? when(t) : `${when(t, $('#tz').value)} · your time ${when(t)}`;
}
const msgCount = () => ($('#msgcount').textContent = `${[...$('#msg').value].length} / 280 characters`);
['input', 'change'].forEach((e) => {
  $('#f').addEventListener(e, preview);
});
$('#msg').addEventListener('input', msgCount);
$('#tz').addEventListener(
  'change',
  () => ($('#tzhint').textContent = $('#tz').value === myTz ? '' : `The time above is wall-clock time in ${$('#tz').value.replace(/_/g, ' ')}.`),
);
everySecond(() => {
  preview();
});
msgCount();

async function copy(text, btn) {
  const old = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch {
    const i = btn.closest('li').querySelector('input');
    i.focus();
    i.select();
    btn.textContent = document.execCommand?.('copy') ? 'Copied' : 'Press Ctrl+C';
  }
  setTimeout(() => (btn.textContent = old), 1500);
}
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids);
  return e;
};

function item(ev) {
  const past = ev.target <= Date.now();
  const t = el('time', { dateTime: new Date(ev.target).toISOString(), textContent: when(ev.target, ev.tz || undefined) });
  const inp = el('input', { id: `l-${ev.id}`, readOnly: true, value: link(ev.id), autocomplete: 'off', spellcheck: false });
  inp.addEventListener('focus', () => inp.select());
  const cp = el('button', { type: 'button', textContent: 'Copy link' });
  cp.addEventListener('click', () => copy(inp.value, cp));
  const open = el('a', { className: 'btn', href: link(ev.id), target: '_blank', rel: 'noopener noreferrer', textContent: 'Open' });
  const act = el('div', { className: 'row' });
  if (confirming === ev.id) {
    const y = el('button', { type: 'button', className: 'danger', textContent: 'Yes, delete' });
    y.addEventListener('click', async () => {
      confirming = null;
      try {
        await api(`/api/events/${ev.id}`, { method: 'DELETE' });
        $('#status').textContent = `Deleted “${ev.title}”. Its link no longer works.`;
      } catch (e) {
        $('#status').textContent = e.message;
      }
      load();
    });
    const n = el('button', { type: 'button', textContent: 'Cancel' });
    n.addEventListener('click', () => {
      confirming = null;
      load().then(() => $(`[data-id="${ev.id}"] .danger`)?.focus());
    });
    act.append(el('span', { textContent: 'Delete this countdown? The link will stop working.' }), y, n);
  } else {
    const d = el('button', { type: 'button', className: 'danger', textContent: 'Delete' });
    d.addEventListener('click', () => {
      confirming = ev.id;
      load().then(() => $(`[data-id="${ev.id}"] .danger`)?.focus());
    });
    act.append(d);
  }
  const li = el(
    'li',
    { className: 'card ev' },
    el('h3', { textContent: ev.title }),
    el(
      'p',
      { className: 'meta' },
      past ? 'Ended ' : 'Ends ',
      t,
      past ? '' : ` · ${spoken(Math.ceil((ev.target - Date.now()) / 60000) * 60000)} to go`,
      ev.message ? ` · message: ${ev.message}` : '',
    ),
    el('div', { className: 'share' }, el('label', { htmlFor: inp.id, className: 'vh', textContent: `Share link for ${ev.title}` }), inp, cp, open),
    act,
  );
  li.dataset.id = ev.id;
  return li;
}

async function load() {
  try {
    const list = await api('/api/events');
    $('#list').replaceChildren(...list.map(item));
    $('#empty').hidden = list.length > 0;
    $('#count').textContent = list.length ? `(${list.length} of 50)` : '';
  } catch (e) {
    $('#status').textContent = `Could not load your countdowns: ${e.message}`;
  }
}

$('#f').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#err').textContent = '';
  const title = $('#title').value.trim(),
    t = target();
  if (!title) {
    $('#err').textContent = 'Give the countdown a title.';
    $('#title').focus();
    return;
  }
  if (!Number.isFinite(t)) {
    $('#err').textContent = 'Pick a date and time.';
    $('#at').focus();
    return;
  }
  if (t <= Date.now()) {
    $('#err').textContent = 'That time has already passed. Pick a future date.';
    $('#at').focus();
    return;
  }
  $('#create').disabled = true;
  try {
    const ev = await api('/api/events', { method: 'POST', body: { title, target: t, tz: $('#tz').value, message: $('#msg').value } });
    $('#status').textContent = `Created “${ev.title}”. Copy its link below to share it.`;
    await load();
    $(`[data-id="${ev.id}"] input`)?.focus();
  } catch (x) {
    $('#err').textContent = x.message;
  } finally {
    $('#create').disabled = false;
  }
});
load();
