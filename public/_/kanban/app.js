import { $, mountBar } from '/_/ui.js';
import { LABELS, board, columnOf, dueState, emptyState, matches, newBoard, reduce, sanitize, today, uid } from './lib.js';
mountBar('Kanban');

const KEY = 'kanban.v1';
const LBL = Object.fromEntries(LABELS.map((l) => [l.id, l]));
const dayFmt = new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short' });

function sample() {
  const d = (n) => {
    const x = new Date();
    x.setDate(x.getDate() + n);
    return today(x);
  };
  const b = newBoard('Website relaunch', ['To do', 'Doing', 'Review', 'Done']);
  const add = (ci, title, labels = [], due = null, notes = '') => {
    const id = uid();
    b.cards[id] = { id, title, notes, labels, due, archived: false, created: Date.now() };
    b.columns[ci].cards.push(id);
  };
  add(0, 'Write migration guide for v2 API', ['yellow'], d(6), 'Cover auth changes and the new pagination.');
  add(0, 'Pick a new colour palette', ['blue'], null);
  add(0, 'Compare search providers', ['purple'], d(12));
  add(1, 'Fix login redirect loop on Safari', ['red', 'orange'], d(-1), 'Only when third-party cookies are blocked.');
  add(1, 'Pricing page', ['green', 'blue'], d(2));
  add(2, 'Dark mode for docs site', ['green'], d(0));
  add(3, 'Set up uptime monitoring', ['green']);
  add(3, 'Redirect old blog URLs', [], null, '301s for /posts/* to /blog/*');
  return { v: 1, current: b.id, boards: [b] };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw === null ? sample() : sanitize(raw);
  } catch {
    return emptyState();
  }
}
let state = load(),
  saveFailed = false;
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    saveFailed = false;
  } catch {
    if (!saveFailed) toast('Could not save: browser storage is blocked or full. Export a backup.');
    saveFailed = true;
  }
}
const ui = { q: '', label: '', archived: false };

// ---- announcements, toast with undo ----
const announce = (m) => {
  $('#live').textContent = '';
  setTimeout(() => ($('#live').textContent = m), 30);
};
let undoState = null,
  toastT;
function toast(msg, undo = null) {
  undoState = undo;
  $('#toastmsg').textContent = msg;
  $('#undo').hidden = !undo;
  clearTimeout(toastT);
  toastT = setTimeout(
    () => {
      $('#toastmsg').textContent = '';
      undoState = null;
      $('#undo').hidden = true;
    },
    undo ? 8000 : 4000,
  );
}
$('#undo').addEventListener('click', () => {
  if (!undoState) return;
  state = undoState;
  undoState = null;
  save();
  render();
  toast('Restored.');
});

/** Applies an action, saves, re-renders, and keeps keyboard focus on the element with the same data-key. */
function act(a, { focus, undo } = {}) {
  const prev = state,
    key = document.activeElement?.dataset?.key;
  state = reduce(state, a);
  save();
  render();
  const k = focus ?? key;
  if (k) $(`[data-key="${CSS.escape(k)}"]`)?.focus();
  if (undo) toast(undo, prev);
}
const el = (tag, props = {}, ...kids) => {
  const e = Object.assign(document.createElement(tag), props);
  e.append(...kids.filter((x) => x != null && x !== false));
  return e;
};
const btn = (text, onClick, props = {}) => {
  const b = el('button', { type: 'button', textContent: text, ...props });
  b.addEventListener('click', onClick);
  if (props.ariaLabel) b.setAttribute('aria-label', props.ariaLabel);
  return b;
};

// ---- rendering ----
function cardEl(b, k) {
  const li = el('li', { className: `k${k.archived ? ' archived' : ''}` });
  li.dataset.id = k.id;
  const chips = k.labels.length
    ? el(
        'div',
        { className: 'chips' },
        ...k.labels.map((l) => {
          const c = el('span', { className: 'chip' }, el('span', { className: 'dot' }), LBL[l].name);
          c.firstChild.style.setProperty('--c', LBL[l].color);
          return c;
        }),
      )
    : null;
  const ds = dueState(k.due);
  const meta = el(
    'div',
    { className: 'meta' },
    k.due
      ? el(
          'span',
          { className: `due ${ds}` },
          ds === 'overdue' ? 'Overdue · ' : ds === 'today' ? 'Due today · ' : 'Due ',
          el('time', { dateTime: k.due, textContent: dayFmt.format(new Date(`${k.due}T12:00`)) }),
        )
      : null,
    k.notes ? el('span', { textContent: 'Has notes' }) : null,
  );
  const open = el('button', { type: 'button', className: 'open', textContent: k.title });
  open.dataset.key = `open-${k.id}`;
  open.addEventListener('click', () => editCard(k.id));
  const grip = el('button', { type: 'button', className: 'grip', textContent: '⠿' });
  grip.dataset.key = `grip-${k.id}`;
  grip.setAttribute('aria-label', `Move card: ${k.title}`);
  grip.setAttribute('aria-describedby', 'movehelp');
  grip.addEventListener('keydown', (e) => onGripKey(e, k.id));
  grip.addEventListener('pointerdown', (e) => startDrag(e, k.id, li));
  li.append(chips ?? '', open, meta.childNodes.length ? meta : '', grip);
  return li;
}

function visibleIds(b) {
  return new Set(
    Object.values(b.cards)
      .filter((k) => !k.archived && matches(k, ui.q, ui.label))
      .map((k) => k.id),
  );
}

function render() {
  const b = board(state);
  $('#boardsel').replaceChildren(...state.boards.map((x) => new Option(x.name, x.id)));
  $('#boardsel').value = b.id;
  $('#bh').textContent = b.name;
  $('#lbl').replaceChildren(new Option('All labels', ''), ...LABELS.map((l) => new Option(l.name, l.id)));
  $('#lbl').value = ui.label;
  const vis = visibleIds(b),
    filtering = !!(ui.q || ui.label);
  const all = Object.values(b.cards),
    active = all.filter((k) => !k.archived);
  const overdue = active.filter((k) => dueState(k.due) === 'overdue').length;
  $('#summary').textContent =
    `${active.length} card${active.length === 1 ? '' : 's'} in ${b.columns.length} column${b.columns.length === 1 ? '' : 's'}${filtering ? `, ${vis.size} match` : ''}${overdue ? `, ${overdue} overdue` : ''}`;
  const cols = b.columns.map((c, ci) => {
    const shown = c.cards.filter((id) => vis.has(id)),
      total = c.cards.filter((id) => !b.cards[id].archived).length;
    const h = el('h3', { id: `ch-${c.id}`, textContent: c.name, title: c.name });
    const count = el('output', { textContent: filtering ? `${shown.length}/${total}` : String(total) });
    count.setAttribute('aria-label', `${filtering ? `${shown.length} of ${total}` : total} cards`);
    const head = el(
      'div',
      { className: 'colhead' },
      h,
      count,
      btn('←', () => act({ type: 'column/move', id: c.id, delta: -1 }, { focus: `cl-${c.id}` }), {
        className: 'ib',
        ariaLabel: `Move column ${c.name} left`,
        disabled: ci === 0,
      }),
      btn('→', () => act({ type: 'column/move', id: c.id, delta: 1 }, { focus: `cr-${c.id}` }), {
        className: 'ib',
        ariaLabel: `Move column ${c.name} right`,
        disabled: ci === b.columns.length - 1,
      }),
      btn('✎', () => askName(`Rename column`, 'Column name', c.name, (n) => act({ type: 'column/rename', id: c.id, name: n }, { focus: `cn-${c.id}` })), {
        className: 'ib',
        ariaLabel: `Rename column ${c.name}`,
      }),
      btn(
        '×',
        () => {
          act({ type: 'column/delete', id: c.id }, { undo: `Deleted column “${c.name}”${total ? ` and its ${total} card${total === 1 ? '' : 's'}` : ''}.` });
          announce(`Column ${c.name} deleted. Undo is available.`);
          $('#newboard').focus();
        },
        { className: 'ib', ariaLabel: `Delete column ${c.name}` },
      ),
    );
    const [l, r, rn] = head.querySelectorAll('button');
    l.dataset.key = `cl-${c.id}`;
    r.dataset.key = `cr-${c.id}`;
    rn.dataset.key = `cn-${c.id}`;
    const ul = el('ul', { className: 'cards' }, ...shown.map((id) => cardEl(b, b.cards[id])));
    ul.dataset.col = c.id;
    ul.setAttribute('aria-labelledby', h.id);
    const inp = el('input', { id: `add-${c.id}`, autocomplete: 'off', maxLength: 200 });
    inp.dataset.key = `add-${c.id}`;
    const f = el(
      'form',
      { className: 'addcard', noValidate: true },
      el('label', { htmlFor: inp.id, className: 'vh', textContent: `Add a card to ${c.name}` }),
      inp,
      el('button', { type: 'submit', textContent: 'Add' }),
    );
    inp.placeholder = 'New card…';
    f.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!inp.value.trim()) {
        inp.focus();
        return;
      }
      const t = inp.value;
      act({ type: 'card/add', col: c.id, title: t }, { focus: `add-${c.id}` });
      announce(`Added “${t.trim()}” to ${c.name}.`);
    });
    const col = el('div', { className: 'col' }, head, ul, f);
    col.dataset.col = c.id;
    return col;
  });
  const addCol = btn('+ Add column', () => askName('New column', 'Column name', '', (n) => act({ type: 'column/add', name: n }, { focus: 'addcol' })), {
    className: 'col addcol',
  });
  addCol.dataset.key = 'addcol';
  $('#board').replaceChildren(...cols, addCol);
  // archived
  $('#archsec').hidden = !ui.archived;
  const arch = all.filter((k) => k.archived);
  $('#archempty').hidden = arch.length > 0;
  $('#arch').replaceChildren(
    ...arch.map((k) => {
      const restore = btn(
        'Restore',
        () => {
          act({ type: 'card/update', id: k.id, patch: { archived: false } });
          announce(`Restored “${k.title}” to ${columnOf(b, k.id)?.name}.`);
          $('#showarch').focus();
        },
        { ariaLabel: `Restore ${k.title}` },
      );
      const del = btn(
        'Delete',
        () => {
          act({ type: 'card/delete', id: k.id }, { undo: `Deleted “${k.title}”.` });
          $('#showarch').focus();
        },
        { className: 'danger', ariaLabel: `Delete ${k.title}` },
      );
      return el('li', {}, el('span', { textContent: `${k.title} (${columnOf(b, k.id)?.name ?? ''})` }), el('div', { className: 'row' }, restore, del));
    }),
  );
}

// ---- keyboard moves ----
function onGripKey(e, id) {
  const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
  if (!dir) return;
  e.preventDefault();
  const b = board(state),
    before = JSON.stringify(b.columns);
  const next = reduce(state, { type: 'card/moveBy', id, dir, visible: visibleIds(b) });
  if (JSON.stringify(board(next).columns) === before) {
    announce(`Can't move ${dir}.`);
    return;
  }
  state = next;
  save();
  render();
  $(`[data-key="grip-${id}"]`)?.focus();
  announceMove(id);
}
function announceMove(id) {
  const b = board(state),
    c = columnOf(b, id),
    vis = visibleIds(b),
    list = c.cards.filter((x) => vis.has(x));
  announce(`Moved “${b.cards[id].title}” to ${c.name}, position ${list.indexOf(id) + 1} of ${list.length}.`);
}

// ---- pointer drag and drop ----
let drag = null;
function startDrag(e, id, li) {
  if (e.button !== 0) return;
  e.preventDefault();
  const r = li.getBoundingClientRect();
  drag = {
    id,
    li,
    sx: e.clientX,
    sy: e.clientY,
    dx: e.clientX - r.left,
    dy: e.clientY - r.top,
    w: r.width,
    started: false,
    ghost: null,
    ph: null,
    target: null,
  };
  e.target.setPointerCapture(e.pointerId);
  e.target.addEventListener('pointermove', onMove);
  e.target.addEventListener('pointerup', onUp, { once: true });
  e.target.addEventListener('pointercancel', onCancel, { once: true });
}
function onMove(e) {
  if (!drag) return;
  if (!drag.started) {
    if (Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) < 5) return;
    drag.started = true;
    drag.ghost = drag.li.cloneNode(true);
    drag.ghost.classList.add('ghost');
    drag.ghost.style.width = `${drag.w}px`;
    drag.ghost.setAttribute('aria-hidden', 'true');
    document.body.append(drag.ghost);
    drag.ph = el('li', { className: 'ph' });
    drag.ph.style.height = `${drag.li.offsetHeight}px`;
    drag.ph.setAttribute('aria-hidden', 'true');
    drag.li.classList.add('dragging');
  }
  drag.ghost.style.left = `${e.clientX - drag.dx}px`;
  drag.ghost.style.top = `${e.clientY - drag.dy}px`;
  const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.col');
  document.querySelectorAll('.col.over').forEach((c) => c !== under && c.classList.remove('over'));
  if (!under?.dataset.col) return;
  under.classList.add('over');
  const ul = under.querySelector('ul.cards');
  const before = [...ul.querySelectorAll('li.k:not(.dragging)')].find((x) => {
    const rr = x.getBoundingClientRect();
    return e.clientY < rr.top + rr.height / 2;
  });
  ul.insertBefore(drag.ph, before ?? null);
  drag.target = { col: under.dataset.col, beforeId: before?.dataset.id ?? null };
  // auto-scroll the board near its edges
  const br = $('#board').getBoundingClientRect();
  if (e.clientX > br.right - 40) $('#board').scrollLeft += 12;
  else if (e.clientX < br.left + 40) $('#board').scrollLeft -= 12;
}
function endDrag() {
  drag?.ghost?.remove();
  drag?.ph?.remove();
  drag?.li.classList.remove('dragging');
  document.querySelectorAll('.col.over').forEach((c) => c.classList.remove('over'));
}
function onUp(e) {
  e.target.removeEventListener('pointermove', onMove);
  const d = drag;
  endDrag();
  drag = null;
  if (!d?.started || !d.target) return;
  const b = board(state),
    col = b.columns.find((c) => c.id === d.target.col);
  const rest = col.cards.filter((x) => x !== d.id);
  const index = d.target.beforeId
    ? rest.indexOf(d.target.beforeId)
    : (() => {
        // after the last visible card, before hidden ones that follow
        const vis = visibleIds(b),
          shown = rest.filter((x) => vis.has(x));
        return shown.length ? rest.indexOf(shown.at(-1)) + 1 : rest.length;
      })();
  act({ type: 'card/move', id: d.id, col: d.target.col, index }, { focus: `grip-${d.id}` });
  announceMove(d.id);
}
function onCancel(e) {
  e.target.removeEventListener('pointermove', onMove);
  endDrag();
  drag = null;
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && drag) {
    endDrag();
    drag = null;
  }
});

// ---- card editor ----
const dlg = $('#dlg');
let editing = null;
$('#clabels').append(
  ...LABELS.map((l) => {
    const cb = el('input', { type: 'checkbox', value: l.id, id: `cl-${l.id}` });
    const dot = el('span', { className: 'dot' });
    dot.style.setProperty('--c', l.color);
    return el('label', { htmlFor: cb.id }, cb, dot, l.name);
  }),
);
function editCard(id) {
  const b = board(state),
    k = b.cards[id];
  editing = id;
  $('#ctitle').value = k.title;
  $('#cnotes').value = k.notes;
  $('#cdue').value = k.due ?? '';
  $('#cerr').textContent = '';
  dlg.querySelectorAll('#clabels input').forEach((cb) => (cb.checked = k.labels.includes(cb.value)));
  $('#ccol').replaceChildren(...b.columns.map((c) => new Option(c.name, c.id)));
  $('#ccol').value = columnOf(b, id).id;
  $('#carch').textContent = k.archived ? 'Unarchive' : 'Archive';
  dlg.showModal();
  $('#ctitle').focus();
}
const closeEdit = (focusKey) => {
  dlg.close();
  const id = editing;
  editing = null;
  if (focusKey !== false) $(`[data-key="${focusKey ?? `open-${id}`}"]`)?.focus();
};
$('#ccancel').addEventListener('click', () => closeEdit());
dlg.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeEdit();
});
$('#cardform').addEventListener('submit', (e) => {
  e.preventDefault();
  if (!$('#ctitle').value.trim()) {
    $('#cerr').textContent = 'A card needs a title.';
    $('#ctitle').focus();
    return;
  }
  const id = editing,
    b = board(state),
    moved = columnOf(b, id).id !== $('#ccol').value;
  state = reduce(state, {
    type: 'card/update',
    id,
    patch: {
      title: $('#ctitle').value,
      notes: $('#cnotes').value,
      due: $('#cdue').value || null,
      labels: [...dlg.querySelectorAll('#clabels input:checked')].map((x) => x.value),
    },
  });
  if (moved) state = reduce(state, { type: 'card/move', id, col: $('#ccol').value });
  save();
  render();
  closeEdit();
  if (moved) announceMove(id);
  else announce('Card saved.');
});
$('#carch').addEventListener('click', () => {
  const id = editing,
    k = board(state).cards[id];
  closeEdit(false);
  act({ type: 'card/update', id, patch: { archived: !k.archived } }, { undo: k.archived ? `Restored “${k.title}”.` : `Archived “${k.title}”.` });
  $('#q').focus();
});
$('#cdel').addEventListener('click', () => {
  const id = editing,
    k = board(state).cards[id],
    col = columnOf(board(state), id);
  closeEdit(false);
  act({ type: 'card/delete', id }, { undo: `Deleted “${k.title}”.` });
  $(`[data-key="add-${col.id}"]`)?.focus();
});

// ---- name dialog (new board / rename / new column) ----
const ndlg = $('#ndlg');
let onName = null,
  nameReturn = null;
function askName(title, label, value, cb) {
  nameReturn = document.activeElement;
  $('#ndlgh').textContent = title;
  $('#nlabel').textContent = label;
  $('#nname').value = value;
  $('#nerr').textContent = '';
  onName = cb;
  ndlg.showModal();
  $('#nname').select();
}
const closeName = () => {
  ndlg.close();
  onName = null;
  nameReturn?.focus?.();
};
$('#ncancel').addEventListener('click', closeName);
ndlg.addEventListener('cancel', (e) => {
  e.preventDefault();
  closeName();
});
$('#nameform').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#nname').value.trim();
  if (!v) {
    $('#nerr').textContent = 'Enter a name.';
    return;
  }
  const cb = onName;
  ndlg.close();
  onName = null;
  cb(v);
  if (!document.activeElement || document.activeElement === document.body) nameReturn?.focus?.();
});

// ---- toolbar ----
$('#boardsel').addEventListener('change', () => act({ type: 'board/select', id: $('#boardsel').value }));
$('#newboard').addEventListener('click', () =>
  askName('New board', 'Board name', '', (n) => {
    act({ type: 'board/add', name: n });
    $('#boardsel').focus();
    announce(`Created board ${n}.`);
  }),
);
$('#renboard').addEventListener('click', () =>
  askName('Rename board', 'Board name', board(state).name, (n) => {
    act({ type: 'board/rename', name: n });
    $('#renboard').focus();
  }),
);
$('#delboard').addEventListener('click', () => {
  const n = board(state).name;
  act({ type: 'board/delete' }, { undo: `Deleted board “${n}”.` });
  $('#boardsel').focus();
});
$('#q').addEventListener('input', () => {
  ui.q = $('#q').value;
  render();
});
$('#lbl').addEventListener('change', () => {
  ui.label = $('#lbl').value;
  render();
});
$('#showarch').addEventListener('change', () => {
  ui.archived = $('#showarch').checked;
  render();
});

$('#export').addEventListener('click', () => {
  const a = el('a', {
    href: URL.createObjectURL(new Blob([JSON.stringify({ format: '6o2f-kanban', ...state }, null, 2)], { type: 'application/json' })),
    download: `kanban-${today()}.json`,
  });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast(`Exported ${state.boards.length} board${state.boards.length === 1 ? '' : 's'}.`);
});
$('#file').addEventListener('change', async () => {
  const f = $('#file').files[0];
  if (!f) return;
  try {
    if (f.size > 5 * 1024 * 1024) throw new Error('File is larger than 5 MB');
    let text = await f.text(),
      imp;
    try {
      imp = sanitize(text);
    } catch (e) {
      throw new Error(e instanceof SyntaxError ? 'Not valid JSON' : e.message, { cause: e });
    }
    const have = new Set(state.boards.map((b) => b.id));
    for (const b of imp.boards) if (have.has(b.id)) b.id = uid();
    const prev = state;
    state = { ...state, boards: [...state.boards, ...imp.boards], current: imp.boards[0].id };
    save();
    render();
    toast(`Imported ${imp.boards.length} board${imp.boards.length === 1 ? '' : 's'} from ${f.name}.`, prev);
  } catch (e) {
    toast(`Import failed: ${e.message}`);
  }
  $('#file').value = '';
});
render();
