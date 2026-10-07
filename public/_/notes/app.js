import { $, esc, mountBar } from '/_/ui.js';
import { KEY, label, matches, merge, newNote, parseImport } from './lib.js';
mountBar('Notes');
const store = {
  get: () => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: (v) => {
    try {
      localStorage.setItem(KEY, v);
      return true;
    } catch {
      return false;
    }
  },
};
let notes = [],
  cur = null,
  timer = null;
try {
  notes = parseImport(store.get() ?? '[]');
} catch {}
if (!notes.length)
  notes = [
    newNote(
      'Welcome',
      'This is a note. It saves as you type and lives only in this browser.\n\nCreate more with New, find them with Search, and use Export all to keep a backup.',
    ),
  ];
cur = notes[0].id;
const persist = () => {
  const ok = store.set(JSON.stringify({ notes }));
  $('#warn').hidden = ok;
  $('#state').textContent = ok ? 'Saved' : 'Not saved';
};
const note = () => notes.find((n) => n.id === cur);
const fmt = (t) => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
function draw() {
  const shown = notes.filter((n) => matches(n, $('#q').value)).sort((a, b) => b.updated - a.updated);
  $('#list').innerHTML = shown
    .map(
      (n) => `<li><button type="button" data-id="${esc(n.id)}" aria-current="${n.id === cur}">${esc(label(n))}<small>${fmt(n.updated)}</small></button></li>`,
    )
    .join('');
  $('#none').hidden = shown.length > 0;
  $('#none').textContent = notes.length ? 'No matching notes.' : 'No notes yet. Press New to start one.';
}
function show() {
  const n = note();
  $('#ed').hidden = !n;
  if (!n) return;
  $('#title').value = n.title;
  $('#body').value = n.body;
  count();
  sure(false);
}
const count = () => {
  const t = $('#body').value;
  $('#count').textContent = `${t.length} characters, ${t.trim() ? t.trim().split(/\s+/).length : 0} words`;
};
const sure = (on) => {
  $('#sure').hidden = !on;
  $('#del').hidden = on;
  if (on) $('#no').focus();
};
function edit() {
  const n = note();
  n.title = $('#title').value;
  n.body = $('#body').value;
  n.updated = Date.now();
  count();
  $('#state').textContent = 'Saving…';
  clearTimeout(timer);
  timer = setTimeout(flush, 300);
}
function flush() {
  if (timer == null) return;
  clearTimeout(timer);
  timer = null;
  persist();
  draw();
}
addEventListener('pagehide', flush);
document.addEventListener('visibilitychange', () => document.hidden && flush());
$('#title').addEventListener('input', edit);
$('#body').addEventListener('input', edit);
$('#q').addEventListener('input', draw);
$('#list').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (b) {
    cur = b.dataset.id;
    draw();
    show();
  }
});
$('#add').addEventListener('click', () => {
  const n = newNote();
  notes.push(n);
  cur = n.id;
  $('#q').value = '';
  persist();
  draw();
  show();
  $('#title').focus();
});
$('#del').addEventListener('click', () => sure(true));
$('#no').addEventListener('click', () => {
  sure(false);
  $('#del').focus();
});
$('#yes').addEventListener('click', () => {
  notes = notes.filter((n) => n.id !== cur);
  cur = notes[0]?.id;
  persist();
  draw();
  show();
  ($('#list button') ?? $('#add')).focus();
});
$('#export').addEventListener('click', () => {
  const a = Object.assign(document.createElement('a'), {
    download: 'notes.json',
    href: URL.createObjectURL(new Blob([JSON.stringify({ notes }, null, 2)], { type: 'application/json' })),
  });
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#import').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async (e) => {
  try {
    const add = parseImport(await e.target.files[0].text());
    notes = merge(notes, add);
    cur ??= notes[0]?.id;
    persist();
    draw();
    show();
    $('#msg').textContent = `Imported ${add.length} note${add.length === 1 ? '' : 's'}.`;
  } catch (x) {
    $('#msg').textContent = `Import failed: ${x.message}`;
  }
  e.target.value = '';
});
persist();
draw();
show();
$('#state').textContent = '';
