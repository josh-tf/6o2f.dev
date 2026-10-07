// Pure helpers for Todo. An item is { id, text, done }.
export const KEY = 'todo:v1';
export const newItem = (text) => ({ id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), text: text.trim().slice(0, 300), done: false });
export const filterItems = (items, f) => items.filter((i) => f === 'all' || (f === 'done') === i.done);
export const counts = (items) => {
  const done = items.filter((i) => i.done).length;
  return { all: items.length, done, active: items.length - done };
};
/** Moves item `id` by dir (-1 up, +1 down) among the items visible in `visible` (ids), keeping hidden ones in place. */
export function move(items, id, dir, visible = items.map((i) => i.id)) {
  const j = visible.indexOf(id) + dir;
  if (j < 0 || j >= visible.length || visible.indexOf(id) < 0) return items;
  return moveTo(items, id, visible[j]);
}
/** Puts item `id` where item `target` is. */
export function moveTo(items, id, target) {
  const a = items.findIndex((i) => i.id === id),
    b = items.findIndex((i) => i.id === target);
  if (a < 0 || b < 0 || a === b) return items;
  const out = items.slice();
  const [x] = out.splice(a, 1);
  out.splice(b, 0, x);
  return out;
}
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('the file is not valid JSON');
  }
  const list = Array.isArray(data) ? data : data?.items;
  if (!Array.isArray(list)) throw new Error('this is not a todo export');
  return list
    .filter((i) => i && typeof i === 'object' && String(i.text ?? '').trim())
    .map((i) => ({ ...newItem(String(i.text)), id: typeof i.id === 'string' && i.id ? i.id.slice(0, 40) : newItem('x').id, done: !!i.done }));
}
