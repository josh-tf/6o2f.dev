import { $, mountBar } from '/_/ui.js';
import { findDupe, hostOf, makeBookmark, mergeImport, normalizeUrl, parseImport, parseTags, tagCounts, toJson, toNetscape, view } from './lib.js';
mountBar('Bookmarks');

const KEY = 'bookmarks.v1';
const SAMPLE = [
  ['https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers', 'HTTP headers reference (MDN)', 'docs,http'],
  ['https://developers.cloudflare.com/workers/', 'Cloudflare Workers docs', 'docs,cloudflare'],
  ['https://caniuse.com/', 'Can I use: browser support tables', 'web,reference'],
  ['https://www.w3.org/WAI/ARIA/apg/patterns/', 'ARIA Authoring Practices: patterns', 'a11y,reference'],
  ['https://regex101.com/', 'regex101: build and test regular expressions', 'tools'],
  ['https://news.ycombinator.com/', 'Hacker News', 'news'],
];
let store = null; // null = storage unavailable
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) {
      const now = Date.now();
      return SAMPLE.map(([url, title, tags], i) => makeBookmark({ url, title, tags, added: now - i * 86_400_000 }));
    }
    const v = JSON.parse(raw);
    return Array.isArray(v)
      ? v
          .filter((b) => b && normalizeUrl(b.url))
          .map((b) => ({ ...b, tags: parseTags(b.tags), added: Number(b.added) || Date.now(), title: String(b.title ?? '') }))
      : [];
  } catch {
    return [];
  }
}
let list = load();
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    store = true;
  } catch {
    if (store !== false) say('Could not save: browser storage is blocked or full. Export to keep your bookmarks.');
    store = false;
  }
}
const ui = { q: '', tag: '', sort: 'newest', editing: null, confirming: null };
const say = (m) => ($('#status').textContent = m);
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids.filter((k) => k != null && k !== false));
  return e;
};
const dateFmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });

function setTag(t) {
  ui.tag = ui.tag === t ? '' : t;
  render();
}

function itemView(b) {
  const li = el('li', { className: 'card bm' });
  li.dataset.id = b.id;
  if (ui.editing === b.id) {
    li.append(editForm(b));
    return li;
  }
  const main = el(
    'div',
    {},
    el('a', { className: 't', href: b.url, target: '_blank', rel: 'noopener noreferrer', textContent: b.title }),
    el('p', { className: 'u', textContent: b.url }),
    el(
      'div',
      { className: 'meta' },
      el('time', { dateTime: new Date(b.added).toISOString(), textContent: `Added ${dateFmt.format(b.added)}` }),
      ...b.tags.map((t) => {
        const x = el('button', { type: 'button', className: 'tag', textContent: `#${t}` });
        x.setAttribute('aria-label', `Show only tag ${t}`);
        x.addEventListener('click', () => setTag(t));
        return x;
      }),
    ),
  );
  const edit = el('button', { type: 'button', textContent: 'Edit' });
  edit.setAttribute('aria-label', `Edit ${b.title}`);
  edit.addEventListener('click', () => {
    ui.editing = b.id;
    ui.confirming = null;
    render();
    $(`[data-id="${b.id}"] input`)?.focus();
  });
  const del = el('button', { type: 'button', className: 'danger', textContent: 'Delete' });
  del.setAttribute('aria-label', `Delete ${b.title}`);
  del.addEventListener('click', () => {
    ui.confirming = b.id;
    render();
    $(`[data-id="${b.id}"] .confirm .danger`)?.focus();
  });
  li.append(main, el('div', { className: 'acts' }, edit, del));
  if (ui.confirming === b.id) {
    const yes = el('button', { type: 'button', className: 'danger', textContent: 'Yes, delete' });
    yes.addEventListener('click', () => {
      list = list.filter((x) => x.id !== b.id);
      ui.confirming = null;
      save();
      render();
      say(`Deleted “${b.title}”.`);
      $('#q').focus();
    });
    const no = el('button', { type: 'button', textContent: 'Cancel' });
    no.addEventListener('click', () => {
      ui.confirming = null;
      render();
      $(`[data-id="${b.id}"] .danger`)?.focus();
    });
    li.append(el('div', { className: 'confirm' }, el('span', { textContent: 'Delete this bookmark?' }), yes, no));
  }
  return li;
}

function editForm(b) {
  const f = el('form', { noValidate: true });
  const field = (id, label, value, props = {}) =>
    el('div', {}, el('label', { htmlFor: id, textContent: label }), el('input', { id, value, autocomplete: 'off', ...props }));
  const err = el('p', { className: 'err' });
  err.setAttribute('role', 'alert');
  const fields = el(
    'div',
    { className: 'fields' },
    field(`eu-${b.id}`, 'URL', b.url, { type: 'url', inputMode: 'url', spellcheck: false, autocapitalize: 'off' }),
    field(`et-${b.id}`, 'Title', b.title, { maxLength: 300 }),
    field(`eg-${b.id}`, 'Tags', b.tags.join(', '), { autocapitalize: 'off' }),
  );
  const cancel = el('button', { type: 'button', textContent: 'Cancel' });
  cancel.addEventListener('click', () => {
    ui.editing = null;
    render();
    $(`[data-id="${b.id}"] button`)?.focus();
  });
  f.append(fields, err, el('div', { className: 'row' }, el('button', { type: 'submit', className: 'primary', textContent: 'Save' }), cancel));
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const nb = makeBookmark({ url: $(`#eu-${b.id}`).value, title: $(`#et-${b.id}`).value, tags: $(`#eg-${b.id}`).value, added: b.added });
    if (typeof nb === 'string') {
      err.textContent = nb;
      return;
    }
    const d = findDupe(list, nb.url, b.id);
    if (d) {
      err.textContent = `Already saved as “${d.title}”.`;
      return;
    }
    Object.assign(b, { url: nb.url, title: nb.title, tags: nb.tags });
    ui.editing = null;
    save();
    render();
    say(`Saved “${b.title}”.`);
    $(`[data-id="${b.id}"] button`)?.focus();
  });
  f.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') cancel.click();
  });
  return f;
}

function render() {
  const tags = tagCounts(list);
  if (ui.tag && !tags.some(([t]) => t === ui.tag)) ui.tag = '';
  $('#tag').replaceChildren(new Option(`All tags`, ''), ...tags.map(([t, n]) => new Option(`${t} (${n})`, t)));
  $('#tag').value = ui.tag;
  $('#taglist').replaceChildren(...tags.map(([t]) => el('option', { value: t })));
  $('#chips').replaceChildren(
    ...tags.slice(0, 16).map(([t, n]) => {
      const b = el('button', { type: 'button', textContent: `#${t} ${n}` });
      b.setAttribute('aria-pressed', String(ui.tag === t));
      b.addEventListener('click', () => setTag(t));
      return b;
    }),
  );
  const shown = view(list, ui);
  // ponytail: a 5,000-link browser import would rebuild every row per keystroke; show the first MAX and ask to narrow.
  const MAX = 300;
  $('#list').replaceChildren(...shown.slice(0, MAX).map(itemView));
  $('#more').textContent = shown.length > MAX ? `Showing the first ${MAX} of ${shown.length} matches. Search or pick a tag to narrow the list.` : '';
  $('#counts').textContent =
    list.length === shown.length ? `${list.length} bookmark${list.length === 1 ? '' : 's'}` : `${shown.length} of ${list.length} shown`;
  $('#empty').hidden = shown.length > 0;
  $('#empty').textContent = list.length
    ? 'Nothing matches. Clear the search or pick another tag.'
    : 'No bookmarks yet. Add one above or import a file from your browser.';
}

// Add
function dupeHint() {
  const u = $('#url').value.trim(),
    d = u && findDupe(list, u);
  $('#dupe').textContent = d ? `Already saved as “${d.title}” (added ${dateFmt.format(d.added)}).` : '';
}
$('#url').addEventListener('input', dupeHint);
$('#add').addEventListener('submit', (e) => {
  e.preventDefault();
  $('#adderr').textContent = '';
  const b = makeBookmark({ url: $('#url').value, title: $('#title').value, tags: $('#tags').value });
  if (typeof b === 'string') {
    $('#adderr').textContent = b;
    $('#url').focus();
    return;
  }
  const d = findDupe(list, b.url);
  if (d) {
    $('#adderr').textContent = `Not added: already saved as “${d.title}”.`;
    $('#url').focus();
    return;
  }
  list.push(b);
  save();
  $('#url').value = $('#title').value = $('#tags').value = '';
  dupeHint();
  ui.q = '';
  $('#q').value = '';
  render();
  say(`Added “${b.title}” (${hostOf(b.url)}).`);
  $('#url').focus();
});

// Filter / sort
$('#q').addEventListener('input', () => {
  ui.q = $('#q').value;
  render();
});
$('#tag').addEventListener('change', () => {
  ui.tag = $('#tag').value;
  render();
});
$('#sort').addEventListener('change', () => {
  ui.sort = $('#sort').value;
  render();
});
document.addEventListener('keydown', (e) => {
  if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) {
    e.preventDefault();
    $('#q').focus();
  }
});

// Import / export
$('#file').addEventListener('change', async () => {
  const f = $('#file').files[0];
  if (!f) return;
  try {
    if (f.size > 20 * 1024 * 1024) throw new Error('File is larger than 20 MB');
    const r = mergeImport(list, parseImport(await f.text()));
    list = r.list;
    save();
    render();
    say(
      `Imported ${r.added} bookmark${r.added === 1 ? '' : 's'} from ${f.name}${r.dupes ? `, skipped ${r.dupes} duplicate${r.dupes === 1 ? '' : 's'}` : ''}${r.invalid ? `, ${r.invalid} without a web URL` : ''}.`,
    );
  } catch (err) {
    say(`Import failed: ${err.message}`);
  }
  $('#file').value = '';
});
function download(name, type, text) {
  const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  say(`Exported ${list.length} bookmarks to ${name}.`);
}
const stamp = () => new Date().toISOString().slice(0, 10);
$('#exhtml').addEventListener('click', () => download(`bookmarks-${stamp()}.html`, 'text/html', toNetscape(list)));
$('#exjson').addEventListener('click', () => download(`bookmarks-${stamp()}.json`, 'application/json', toJson(list)));

render();
