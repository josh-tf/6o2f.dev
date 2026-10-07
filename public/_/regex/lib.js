// Regex matching, shared by the worker and the unit tests. Throws SyntaxError on a bad pattern.
export const MAX = 1000;
export function execAll(pattern, flags, text, repl) {
  const re = new RegExp(pattern, flags),
    matches = [];
  let truncated = false;
  for (let m; (m = re.exec(text));) {
    if (matches.length >= MAX) {
      truncated = true;
      break;
    }
    matches.push({ index: m.index, text: m[0], groups: [...m].slice(1), named: m.groups ? { ...m.groups } : null });
    if (!re.global && !re.sticky) break;
    if (m[0] === '') re.lastIndex++; // step over empty matches
  }
  const replaced = repl == null ? null : text.replace(new RegExp(pattern, flags), repl);
  return { matches, truncated, replaced };
}

/** Split text into [{text, hit}] runs for highlighting; empty matches are skipped. */
export function segments(text, matches) {
  const out = [];
  let at = 0;
  for (const m of matches) {
    if (!m.text) continue;
    if (m.index > at) out.push({ text: text.slice(at, m.index), hit: false });
    out.push({ text: m.text, hit: true });
    at = m.index + m.text.length;
  }
  if (at < text.length) out.push({ text: text.slice(at), hit: false });
  return out;
}
