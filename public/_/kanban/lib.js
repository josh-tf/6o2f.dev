// Pure board state + reducer (no DOM). Tested from src/tools/kanban/lib.test.ts.
// State: { v: 1, current, boards: [{ id, name, columns: [{ id, name, cards: [cardId] }], cards: { [id]: Card } }] }
// Card: { id, title, notes, labels: [labelId], due: 'YYYY-MM-DD' | null, archived: boolean, created }

export const LABELS = [
  { id: 'red', name: 'Bug', color: '#e5484d' },
  { id: 'orange', name: 'Urgent', color: '#f76b15' },
  { id: 'yellow', name: 'Docs', color: '#e2a336' },
  { id: 'green', name: 'Feature', color: '#30a46c' },
  { id: 'blue', name: 'Design', color: '#3e8ef7' },
  { id: 'purple', name: 'Research', color: '#8e4ec6' },
];
export const MAX_TITLE = 200,
  MAX_NOTES = 4000,
  MAX_NAME = 60;

let seq = 0;
export const uid = () => globalThis.crypto?.randomUUID?.().slice(0, 8) ?? `${Date.now().toString(36)}${(seq++).toString(36)}`;
const clean = (s, max) =>
  String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Imported ids end up in DOM ids and selectors: keep only safe ones, else mint a new id. */
const safeId = (v) => (/^[\w-]{1,40}$/.test(String(v ?? '')) ? String(v) : uid());

export function newBoard(name, columns = ['To do', 'Doing', 'Done']) {
  return { id: uid(), name: clean(name, MAX_NAME) || 'Untitled board', columns: columns.map((n) => ({ id: uid(), name: n, cards: [] })), cards: {} };
}
export const emptyState = () => {
  const b = newBoard('My board');
  return { v: 1, current: b.id, boards: [b] };
};
export const board = (s) => s.boards.find((b) => b.id === s.current) ?? s.boards[0];
export const columnOf = (b, cardId) => b.columns.find((c) => c.cards.includes(cardId));

/** Moves a card to `toCol` at `toIndex` (index in the target list after the card is taken out; clamped). */
export function moveCard(b, cardId, toColId, toIndex) {
  const from = columnOf(b, cardId),
    to = b.columns.find((c) => c.id === toColId);
  if (!from || !to) return false;
  from.cards.splice(from.cards.indexOf(cardId), 1);
  const i = Math.max(0, Math.min(Number.isInteger(toIndex) ? toIndex : to.cards.length, to.cards.length));
  to.cards.splice(i, 0, cardId);
  return true;
}

/**
 * Keyboard move: left/right go to the neighbouring column at the same position (clamped), up/down reorder within the
 * column, skipping cards that are archived or hidden by the current filter (`visible` = ids shown on screen).
 */
export function moveBy(b, cardId, dir, visible) {
  const col = columnOf(b, cardId);
  if (!col) return null;
  const shown = (c) => c.cards.filter((id) => !b.cards[id]?.archived && (!visible || visible.has(id) || id === cardId));
  const ci = b.columns.indexOf(col),
    list = shown(col),
    pos = list.indexOf(cardId);
  if (dir === 'left' || dir === 'right') {
    const tc = b.columns[ci + (dir === 'left' ? -1 : 1)];
    if (!tc) return null;
    const tl = shown(tc),
      anchor = tl[pos]; // insert before the card currently at the same visible position
    moveCard(b, cardId, tc.id, anchor ? tc.cards.indexOf(anchor) : tc.cards.length);
    return { col: tc, index: Math.min(pos, tl.length) };
  }
  const np = pos + (dir === 'up' ? -1 : 1);
  if (np < 0 || np >= list.length) return null;
  const other = list[np];
  col.cards.splice(col.cards.indexOf(cardId), 1);
  col.cards.splice(col.cards.indexOf(other) + (dir === 'up' ? 0 : 1), 0, cardId);
  return { col, index: np };
}

/** Returns a new state; the input is never mutated (so the previous state can be kept for undo). */
export function reduce(state, a) {
  const s = structuredClone(state),
    b = board(s);
  const col = (id) => b.columns.find((c) => c.id === id);
  switch (a.type) {
    case 'board/add': {
      const nb = newBoard(a.name);
      s.boards.push(nb);
      s.current = nb.id;
      break;
    }
    case 'board/select':
      if (s.boards.some((x) => x.id === a.id)) s.current = a.id;
      break;
    case 'board/rename':
      if (clean(a.name, MAX_NAME)) b.name = clean(a.name, MAX_NAME);
      break;
    case 'board/delete': {
      s.boards = s.boards.filter((x) => x.id !== b.id);
      if (!s.boards.length) s.boards.push(newBoard('My board'));
      s.current = s.boards[0].id;
      break;
    }
    case 'column/add':
      b.columns.push({ id: uid(), name: clean(a.name, MAX_NAME) || 'New column', cards: [] });
      break;
    case 'column/rename': {
      const c = col(a.id);
      if (c && clean(a.name, MAX_NAME)) c.name = clean(a.name, MAX_NAME);
      break;
    }
    case 'column/delete': {
      const c = col(a.id);
      if (!c) break;
      for (const id of c.cards) delete b.cards[id];
      b.columns = b.columns.filter((x) => x !== c);
      break;
    }
    case 'column/move': {
      const i = b.columns.findIndex((c) => c.id === a.id),
        j = i + a.delta;
      if (i < 0 || j < 0 || j >= b.columns.length) break;
      const [c] = b.columns.splice(i, 1);
      b.columns.splice(j, 0, c);
      break;
    }
    case 'card/add': {
      const c = col(a.col),
        title = clean(a.title, MAX_TITLE);
      if (!c || !title) break;
      const id = a.id ?? uid();
      b.cards[id] = { id, title, notes: '', labels: [], due: null, archived: false, created: a.now ?? Date.now() };
      c.cards.push(id);
      break;
    }
    case 'card/update': {
      const k = b.cards[a.id];
      if (!k) break;
      const p = a.patch;
      if (p.title !== undefined && clean(p.title, MAX_TITLE)) k.title = clean(p.title, MAX_TITLE);
      if (p.notes !== undefined) k.notes = String(p.notes).slice(0, MAX_NOTES);
      if (p.labels !== undefined) k.labels = LABELS.map((l) => l.id).filter((l) => p.labels.includes(l));
      if (p.due !== undefined) k.due = DATE.test(p.due ?? '') ? p.due : null;
      if (p.archived !== undefined) k.archived = !!p.archived;
      break;
    }
    case 'card/delete': {
      const c = columnOf(b, a.id);
      if (c) c.cards.splice(c.cards.indexOf(a.id), 1);
      delete b.cards[a.id];
      break;
    }
    case 'card/move':
      moveCard(b, a.id, a.col, a.index);
      break;
    case 'card/moveBy':
      moveBy(b, a.id, a.dir, a.visible);
      break;
    default:
      throw new Error(`Unknown action ${a.type}`);
  }
  return s;
}

/** Validates and repairs imported/stored state. Throws with a readable message when it is not a board export. */
export function sanitize(raw) {
  const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  const boards = Array.isArray(data?.boards) ? data.boards : data?.columns ? [data] : null;
  if (!boards?.length) throw new Error('Not a kanban export: expected "boards"');
  const out = boards.slice(0, 50).map((ob) => {
    const nb = { id: safeId(ob.id), name: clean(ob.name, MAX_NAME) || 'Imported board', columns: [], cards: {} };
    for (let oc of Array.isArray(ob.columns) ? ob.columns.slice(0, 50) : []) {
      if (nb.columns.some((x) => x.id === String(oc.id))) oc = { ...oc, id: undefined };
      const c = { id: safeId(oc.id), name: clean(oc.name, MAX_NAME) || 'Column', cards: [] };
      for (const cid of Array.isArray(oc.cards) ? oc.cards : []) {
        const k = typeof cid === 'object' ? cid : ob.cards?.[cid];
        if (!k || typeof k !== 'object' || !clean(k.title, MAX_TITLE)) continue;
        let id = safeId(k.id ?? cid);
        if (nb.cards[id]) id = uid();
        nb.cards[id] = {
          id,
          title: clean(k.title, MAX_TITLE),
          notes: String(k.notes ?? '').slice(0, MAX_NOTES),
          labels: LABELS.map((l) => l.id).filter((l) => Array.isArray(k.labels) && k.labels.includes(l)),
          due: DATE.test(k.due ?? '') ? k.due : null,
          archived: !!k.archived,
          created: Number(k.created) || Date.now(),
        };
        c.cards.push(id);
      }
      nb.columns.push(c);
    }
    return nb;
  });
  const ids = new Set();
  for (const b of out) {
    if (ids.has(b.id)) b.id = uid();
    ids.add(b.id);
  }
  return { v: 1, current: out.some((b) => b.id === data.current) ? data.current : out[0].id, boards: out };
}

/** Local calendar date as YYYY-MM-DD. */
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
/** 'overdue' | 'today' | 'soon' (within 2 days) | 'later' | null */
export function dueState(due, now = today()) {
  if (!due) return null;
  if (due < now) return 'overdue';
  if (due === now) return 'today';
  const days = (Date.parse(due) - Date.parse(now)) / 86_400_000;
  return days <= 2 ? 'soon' : 'later';
}
/** Card matches a search (title and notes, every word) and an optional label. */
export const matches = (k, q, label) =>
  (!label || k.labels.includes(label)) &&
  q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => `${k.title}\n${k.notes}`.toLowerCase().includes(w));
