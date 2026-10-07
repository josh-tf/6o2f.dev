// YAML <-> JSON conversion (browser + node tests). `yaml` is the js-yaml module (window.jsyaml in the page).
import { parse } from '../json/lib.js'; // JSON error positions

/** Throws Error with .line/.col (1-based) on bad input. Several YAML documents (---) become a JSON array. */
export function convert(text, dir, yaml, { indent = 2, sortKeys = false } = {}) {
  if (dir === 'j2y') {
    const r = parse(text);
    if ('error' in r) throw Object.assign(new Error(r.error), { line: r.line, col: r.col });
    return { text: yaml.dump(r.value, { indent, sortKeys, lineWidth: 100, noRefs: true }), docs: 1 };
  }
  let docs;
  try {
    docs = yaml.loadAll(text);
  } catch (e) {
    throw Object.assign(new Error(e.reason || e.message), e.mark ? { line: e.mark.line + 1, col: e.mark.column + 1 } : {});
  }
  const value = docs.length === 1 ? docs[0] : docs;
  return { text: JSON.stringify(value, null, indent) ?? 'null', docs: docs.length };
}
