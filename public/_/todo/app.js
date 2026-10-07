import { $, esc, mountBar } from '/_/ui.js';
import { KEY, counts, filterItems, move, moveTo, newItem, parseImport } from './lib.js';
mountBar('Todo');
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
let items = [],
  filter = 'all',
  editing = null,
  dragId = null;
try {
  items = parseImport(store.get() ?? '[]');
} catch {}
if (store.get() === null) {
  items = ['Try the keyboard: type a task and press Enter', 'Reorder with the arrow buttons or drag', 'Tick this one off', 'Export a backup now and then'].map(
    newItem,
  );
  items[2].done = true;
}
const save = () => {
  $('#warn').hidden = store.set(JSON.stringify({ items }));
};
function draw(focus) {
  const shown = filterItems(items, filter),
    c = counts(items);
  $('#list').innerHTML = shown
    .map(
      (i) => `<li data-id="${esc(i.id)}" class="${i.done ? 'done' : ''}" draggable="${editing !== i.id}">
    <input type="checkbox" aria-label="Done: ${esc(i.text)}" ${i.done ? 'checked' : ''}>
    ${editing === i.id ? `<input type="text" class="ed" aria-label="Edit task" maxlength="300" value="${esc(i.text)}">` : `<button type="button" class="t" data-a="edit" title="Edit" aria-label="Edit: ${esc(i.text)}">${esc(i.text)}</button>`}
    <button type="button" class="i" data-a="up" aria-label="Move up: ${esc(i.text)}">↑</button><button type="button" class="i" data-a="down" aria-label="Move down: ${esc(i.text)}">↓</button><button type="button" class="i danger" data-a="del" aria-label="Delete: ${esc(i.text)}">✕</button></li>`,
    )
    .join('');
  $('#empty').hidden = shown.length > 0;
  $('#empty').textContent = !items.length ? 'No tasks yet. Add one above.' : filter === 'done' ? 'Nothing completed yet.' : 'All done. Nice.';
  $('#count').textContent = `${c.active} active, ${c.done} done`;
  $('#clear').disabled = !c.done;
  for (const b of document.querySelectorAll('[data-f]')) b.setAttribute('aria-pressed', b.dataset.f === filter);
  if (editing) $('.ed')?.focus();
  else if (focus) $(`li[data-id="${focus[0]}"] [data-a="${focus[1]}"]`)?.focus();
}
const set = (next, focus) => {
  items = next;
  save();
  draw(focus);
};
$('#new').addEventListener('submit', (e) => {
  e.preventDefault();
  const t = $('#text').value.trim();
  if (!t) return;
  $('#text').value = '';
  set([...items, newItem(t)]);
});
document.querySelector('.bar2').addEventListener('click', (e) => {
  if (e.target.dataset.f) {
    filter = e.target.dataset.f;
    draw();
  }
});
$('#clear').addEventListener('click', () => set(items.filter((i) => !i.done)));
const idOf = (e) => e.target.closest('li')?.dataset.id;
$('#list').addEventListener('click', (e) => {
  const id = idOf(e),
    a = e.target.dataset.a;
  if (!id || !a) return;
  const vis = filterItems(items, filter).map((i) => i.id);
  if (a === 'del') {
    const k = vis.indexOf(id),
      nxt = vis[k + 1] ?? vis[k - 1];
    set(
      items.filter((i) => i.id !== id),
      nxt && [nxt, 'del'],
    );
    if (!nxt) $('#text').focus();
  } // keep keyboard focus in the list
  else if (a === 'edit') {
    editing = id;
    draw();
  } else set(move(items, id, a === 'up' ? -1 : 1, vis), [id, a]);
});
$('#list').addEventListener('change', (e) => {
  const id = idOf(e);
  if (id && e.target.type === 'checkbox') set(items.map((i) => (i.id === id ? { ...i, done: e.target.checked } : i)));
});
$('#list').addEventListener('keydown', (e) => {
  if (!e.target.classList.contains('ed')) return;
  const id = idOf(e);
  // Enter must preventDefault, or its keypress re-clicks the Edit button that draw() refocuses
  if (e.key === 'Escape') {
    editing = null;
    draw([id, 'edit']);
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const t = e.target.value.trim();
    editing = null;
    set(t ? items.map((i) => (i.id === id ? { ...i, text: t } : i)) : items.filter((i) => i.id !== id), t ? [id, 'edit'] : undefined);
  }
});
$('#list').addEventListener('focusout', (e) => {
  if (editing && e.target.classList.contains('ed')) {
    const id = idOf(e),
      t = e.target.value.trim();
    editing = null;
    set(t ? items.map((i) => (i.id === id ? { ...i, text: t } : i)) : items);
  }
});
$('#list').addEventListener('dragstart', (e) => {
  dragId = idOf(e);
});
$('#list').addEventListener('dragover', (e) => {
  if (dragId) e.preventDefault();
});
$('#list').addEventListener('drop', (e) => {
  const t = idOf(e);
  e.preventDefault();
  if (dragId && t) set(moveTo(items, dragId, t));
  dragId = null;
});
$('#export').addEventListener('click', () => {
  const a = Object.assign(document.createElement('a'), {
    download: 'todo.json',
    href: URL.createObjectURL(new Blob([JSON.stringify({ items }, null, 2)], { type: 'application/json' })),
  });
  a.click();
  URL.revokeObjectURL(a.href);
});
$('#import').addEventListener('click', () => $('#file').click());
$('#file').addEventListener('change', async (e) => {
  try {
    const add = parseImport(await e.target.files[0].text());
    set([...items.filter((i) => !add.some((a) => a.id === i.id)), ...add]);
    $('#msg').textContent = `Imported ${add.length} task${add.length === 1 ? '' : 's'}.`;
  } catch (x) {
    $('#msg').textContent = `Import failed: ${x.message}`;
  }
  e.target.value = '';
});
save();
draw();
