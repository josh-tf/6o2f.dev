// Pure helpers for Notes. A note is { id, title, body, updated }.
export const KEY = 'notes:v1';
export const newNote = (title = '', body = '') => ({ id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36), title, body, updated: Date.now() });
export const matches = (n, q) => !q || `${n.title}\n${n.body}`.toLowerCase().includes(q.trim().toLowerCase());
export const label = (n) => n.title.trim() || n.body.trim().split('\n')[0].slice(0, 40) || 'Untitled';
/** Validates imported JSON ({notes:[...]} or a bare array); returns clean notes, throws on garbage. */
export function parseImport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('the file is not valid JSON');
  }
  const list = Array.isArray(data) ? data : data?.notes;
  if (!Array.isArray(list)) throw new Error('this is not a notes export');
  return list
    .filter((n) => n && typeof n === 'object')
    .map((n) => ({
      id: typeof n.id === 'string' && n.id ? n.id.slice(0, 40) : newNote().id,
      title: String(n.title ?? '').slice(0, 200),
      body: String(n.body ?? ''),
      updated: Number(n.updated) || Date.now(),
    }));
}
/** Imported notes replace same-id notes and are added otherwise. */
export const merge = (have, add) => [...have.filter((n) => !add.some((a) => a.id === n.id)), ...add];
