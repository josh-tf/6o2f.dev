import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-ignore plain ES module shared with the browser
import { reduce, emptyState, board, moveCard, moveBy, sanitize, dueState, matches, columnOf } from '../../../public/_/kanban/lib.js';

type S = ReturnType<typeof emptyState>;
const ids = (s: S) =>
  board(s)
    .columns.map((c: { name: string; cards: string[] }) => `${c.name}:${c.cards.join(',')}`)
    .join(' | ');
function seeded() {
  let s = emptyState();
  const [todo, doing] = board(s).columns.map((c: { id: string }) => c.id);
  for (const id of ['a', 'b', 'c']) s = reduce(s, { type: 'card/add', col: todo, title: `Card ${id}`, id, now: 1 });
  s = reduce(s, { type: 'card/add', col: doing, title: 'Card d', id: 'd', now: 1 });
  return s;
}

test('reducer is pure and adds cards', () => {
  const s0 = emptyState();
  const s1 = reduce(s0, { type: 'card/add', col: board(s0).columns[0].id, title: '  Hello   world ', id: 'x', now: 5 });
  assert.equal(board(s0).columns[0].cards.length, 0); // input untouched (undo keeps it)
  assert.deepEqual(board(s1).cards.x, { id: 'x', title: 'Hello world', notes: '', labels: [], due: null, archived: false, created: 5 });
  assert.equal(board(reduce(s1, { type: 'card/add', col: board(s1).columns[0].id, title: '   ' })).columns[0].cards.length, 1);
  assert.throws(() => reduce(s0, { type: 'nope' }), /Unknown action/);
});

test('drag move: between columns and within a column, index clamped', () => {
  const s = seeded(),
    b = board(s);
  const [todo, doing, done] = b.columns.map((c: { id: string }) => c.id);
  moveCard(b, 'a', doing, 0);
  assert.equal(ids(s), 'To do:b,c | Doing:a,d | Done:');
  moveCard(b, 'b', todo, 99);
  assert.equal(ids(s), 'To do:c,b | Doing:a,d | Done:');
  moveCard(b, 'd', done, -4);
  assert.equal(ids(s), 'To do:c,b | Doing:a | Done:d');
  assert.equal(moveCard(b, 'zzz', done, 0), false);
});

test('keyboard moves: left/right keep position, up/down swap, edges are no-ops', () => {
  const s = seeded(),
    b = board(s);
  assert.deepEqual(moveBy(b, 'b', 'right')?.index, 1);
  assert.equal(ids(s), 'To do:a,c | Doing:d,b | Done:');
  assert.equal(moveBy(b, 'a', 'left'), null);
  assert.equal(moveBy(b, 'a', 'up'), null);
  moveBy(b, 'a', 'down');
  assert.equal(ids(s), 'To do:c,a | Doing:d,b | Done:');
  moveBy(b, 'b', 'up');
  assert.equal(ids(s), 'To do:c,a | Doing:b,d | Done:');
  moveBy(b, 'd', 'right');
  moveBy(b, 'd', 'right');
  assert.equal(ids(s), 'To do:c,a | Doing:b | Done:d');
});

test('keyboard moves skip archived and filtered-out cards', () => {
  let s = seeded();
  s = reduce(s, { type: 'card/update', id: 'b', patch: { archived: true } });
  s = reduce(s, { type: 'card/moveBy', id: 'c', dir: 'up' });
  assert.equal(ids(s), 'To do:c,a,b | Doing:d | Done:'); // jumped over archived b, landed before a
  s = reduce(s, { type: 'card/moveBy', id: 'c', dir: 'down', visible: new Set(['c']) });
  assert.equal(ids(s), 'To do:c,a,b | Doing:d | Done:'); // nothing visible below
});

test('columns and boards', () => {
  let s = seeded();
  const todo = board(s).columns[0].id;
  s = reduce(s, { type: 'column/move', id: todo, delta: 1 });
  assert.equal(board(s).columns[1].id, todo);
  s = reduce(s, { type: 'column/move', id: todo, delta: 5 });
  assert.equal(board(s).columns[1].id, todo);
  s = reduce(s, { type: 'column/rename', id: todo, name: 'Backlog' });
  s = reduce(s, { type: 'column/delete', id: todo });
  assert.equal(board(s).cards.a, undefined);
  assert.equal(ids(s), 'Doing:d | Done:');
  s = reduce(s, { type: 'column/add', name: '' });
  assert.equal(board(s).columns.at(-1).name, 'New column');
  s = reduce(s, { type: 'board/add', name: 'Second' });
  assert.equal(board(s).name, 'Second');
  assert.equal(s.boards.length, 2);
  s = reduce(s, { type: 'board/delete' });
  assert.equal(s.boards.length, 1);
  s = reduce(s, { type: 'board/delete' });
  assert.equal(s.boards.length, 1); // always keeps one board
});

test('card updates are validated; delete removes from column', () => {
  let s = seeded();
  s = reduce(s, { type: 'card/update', id: 'a', patch: { title: ' ', labels: ['blue', 'bogus', 'red'], due: '2026-13', notes: 'n' } });
  assert.deepEqual(board(s).cards.a, { ...board(s).cards.a, title: 'Card a', labels: ['red', 'blue'], due: null, notes: 'n' });
  s = reduce(s, { type: 'card/update', id: 'a', patch: { due: '2026-10-01' } });
  assert.equal(board(s).cards.a.due, '2026-10-01');
  s = reduce(s, { type: 'card/delete', id: 'a' });
  assert.equal(columnOf(board(s), 'a'), undefined);
  assert.equal(board(s).cards.a, undefined);
});

test('import sanitising', () => {
  const s = seeded();
  const back = sanitize(JSON.stringify(s));
  assert.deepEqual(back, s);
  const inline = sanitize({ name: 'X', columns: [{ name: 'Col', cards: [{ title: 'T', labels: ['green', 'x'], due: 'bad', notes: 5 }, { title: '' }] }] });
  const nb = board(inline);
  assert.equal(nb.columns[0].cards.length, 1);
  const k = nb.cards[nb.columns[0].cards[0]];
  assert.deepEqual([k.title, k.labels, k.due, k.notes], ['T', ['green'], null, '5']);
  assert.throws(() => sanitize({ hello: 1 }), /Not a kanban export/);
  assert.throws(() => sanitize('{bad'));
});

test('due dates and filters', () => {
  assert.equal(dueState('2026-10-06', '2026-10-07'), 'overdue');
  assert.equal(dueState('2026-10-07', '2026-10-07'), 'today');
  assert.equal(dueState('2026-10-09', '2026-10-07'), 'soon');
  assert.equal(dueState('2026-10-10', '2026-10-07'), 'later');
  assert.equal(dueState(null), null);
  const k = { title: 'Fix login bug', notes: 'Safari only', labels: ['red'] };
  assert.equal(matches(k, 'login safari', ''), true);
  assert.equal(matches(k, 'login', 'blue'), false);
  assert.equal(matches(k, '', 'red'), true);
});

test('import replaces unsafe and duplicate ids', () => {
  const s = sanitize({
    boards: [
      {
        id: 'b"1',
        name: 'B',
        columns: [
          { id: 'c1', name: 'A', cards: [{ id: 'x"]', title: 'T' }] },
          { id: 'c1', name: 'B', cards: [] },
        ],
      },
    ],
  });
  const b = s.boards[0];
  assert.match(b.id, /^[\w-]+$/);
  assert.notEqual(b.columns[0].id, b.columns[1].id);
  const [cid] = b.columns[0].cards;
  assert.match(cid, /^[\w-]+$/);
  assert.equal(b.cards[cid].title, 'T');
});
