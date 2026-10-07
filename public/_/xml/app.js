import { $, mountBar } from '/_/ui.js';
import { parse, format, minify, toJson, fromJson, parserErrorInfo, offsetOf, XmlError } from './lib.js';
mountBar('XML');
const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Feed excerpt with namespaces, attributes, entities and CDATA -->
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">
<title>Release notes</title><updated>2026-10-01T09:30:00Z</updated>
<entry><id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id><title>v2.4 &amp; friends</title>
<link rel="alternate" href="https://example.com/v2.4"/><category term="release"/><category term="api"/>
<media:thumbnail url="https://example.com/v2.4.png" width="640" height="360"/>
<content type="html"><![CDATA[<p>Faster <b>builds</b> & smaller bundles.</p>]]></content></entry>
<entry><id>urn:uuid:60a76c80-d399-11d9-b93C-0003939e0af6</id><title>v2.3</title><link rel="alternate" href="https://example.com/v2.3"/></entry>
</feed>`;
const input = $('#in'),
  out = $('#out'),
  status = $('#status'),
  error = $('#error'),
  warn = $('#warn');
const IND = { 2: '  ', 4: '    ', tab: '\t' };
let at = 0,
  lastMode = 'format';
input.value = SAMPLE_XML;

/** DOMParser is the authority on well-formedness; the parsed document is only inspected, never attached to the page. */
function validate(src) {
  const doc = new DOMParser().parseFromString(src, 'application/xml');
  const pe =
    doc.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'parsererror')[0] ??
    doc.getElementsByTagNameNS('http://www.mozilla.org/newlayout/xml/parsererror.xml', 'parsererror')[0];
  return pe ? parserErrorInfo(pe.textContent) : null;
}
function showError(msg, line, col, src) {
  out.value = '';
  status.textContent = '';
  at = line ? offsetOf(src, line, col) : 0;
  $('#errmsg').textContent = msg;
  const text = src.split('\n')[line - 1];
  $('#excerpt').textContent =
    line && text !== undefined ? `${String(line).padStart(4)} | ${text.slice(0, 200)}\n${' '.repeat(7 + Math.min(col - 1, 200))}^` : '';
  $('#excerpt').hidden = !$('#excerpt').textContent;
  $('#goto').hidden = !line;
  error.hidden = false;
}
function stats(doc) {
  let n = 0,
    depth = 0;
  const walk = (node, d) => {
    if (node.type === 'element') {
      n++;
      depth = Math.max(depth, d);
    }
    node.children?.forEach((c) => walk(c, d + 1));
  };
  doc.children.forEach((c) => walk(c, 1));
  return `${n.toLocaleString()} element${n === 1 ? '' : 's'}, ${depth} level${depth === 1 ? '' : 's'} deep`;
}
function run() {
  const mode = $('#mode').value,
    src = input.value,
    indent = IND[$('#indent').value],
    comments = $('#comments').checked;
  error.hidden = warn.hidden = true;
  document.querySelectorAll('[data-for]').forEach((e) => (e.hidden = !e.dataset.for.split(' ').includes(mode)));
  $('#indent').disabled = mode === 'minify';
  $('#inlabel').textContent = mode === 'fromjson' ? 'JSON' : 'XML';
  $('#outlabel').textContent = mode === 'tojson' ? 'JSON' : 'XML';
  if (!src.trim()) {
    out.value = '';
    status.textContent = `Paste ${mode === 'fromjson' ? 'JSON' : 'XML'} above.`;
    return;
  }
  const bytes = (s) => `${new Blob([s]).size.toLocaleString()} B`;
  if (mode === 'fromjson') {
    let v;
    try {
      v = JSON.parse(src);
    } catch (e) {
      const m = /line (\d+) column (\d+)/.exec(e.message),
        p = /position (\d+)/.exec(e.message);
      let line = m ? +m[1] : 0,
        col = m ? +m[2] : 0;
      if (!m && p) {
        const b = src.slice(0, +p[1]);
        line = b.split('\n').length;
        col = +p[1] - b.lastIndexOf('\n');
      }
      showError(`Invalid JSON: ${e.message.replace(/ in JSON at.*| \(line.*/, '')}${line ? ` (line ${line}, column ${col})` : ''}`, line, col, src);
      return;
    }
    const r = fromJson(v, { indent, root: $('#root').value.trim() || 'root', declaration: $('#decl').checked });
    out.value = r.xml;
    if (r.warnings.length) {
      warn.replaceChildren(...r.warnings.map((w) => Object.assign(document.createElement('li'), { textContent: w })));
      warn.hidden = false;
    }
    status.textContent = `Converted. ${bytes(src)} JSON in, ${bytes(out.value)} XML out.`;
    return;
  }
  const bad = validate(src);
  if (bad) {
    // the browser decides validity; our parser usually words the problem more clearly, so use its message when it agrees
    try {
      parse(src);
    } catch (e) {
      if (e instanceof XmlError) {
        showError(`Not well-formed XML: ${e.message}`, e.line, e.col, src);
        return;
      }
    }
    showError(`Not well-formed XML: ${bad.message}${bad.line ? ` (line ${bad.line}, column ${bad.col})` : ''}`, bad.line, bad.col, src);
    return;
  }
  try {
    const doc = parse(src);
    if (mode === 'format') out.value = format(src, { indent, comments });
    else if (mode === 'minify') out.value = minify(src, { comments });
    else out.value = JSON.stringify(toJson(src, { cdata: $('#cdata').value, comments }), null, indent);
    status.textContent = `Valid XML: ${stats(doc)}. ${bytes(src)} in, ${bytes(out.value)} out.`;
  } catch (e) {
    if (e instanceof XmlError) showError(e.message, e.line, e.col, src);
    else throw e;
  }
}
let t;
input.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(run, input.value.length > 200000 ? 300 : 80);
});
$('#root').addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(run, 200);
});
for (const id of ['indent', 'cdata', 'comments', 'decl']) $('#' + id).addEventListener('change', run);
$('#mode').addEventListener('change', () => {
  const m = $('#mode').value,
    wasJson = lastMode === 'fromjson',
    isJson = m === 'fromjson';
  // switching between XML input and JSON input: carry the converted text over so there is always something to look at
  if (wasJson !== isJson && input.value.trim()) {
    if (isJson) {
      try {
        input.value = JSON.stringify(toJson(input.value), null, 2);
      } catch {}
    } else if (out.value) input.value = out.value;
  }
  lastMode = m;
  run();
});
$('#sample').addEventListener('click', () => {
  input.value = $('#mode').value === 'fromjson' ? JSON.stringify(toJson(SAMPLE_XML), null, 2) : SAMPLE_XML;
  run();
  input.focus();
});
$('#clear').addEventListener('click', () => {
  input.value = '';
  run();
  input.focus();
});
$('#swap').addEventListener('click', () => {
  if (!out.value) return;
  const m = $('#mode').value;
  input.value = out.value;
  if (m === 'tojson') $('#mode').value = 'fromjson';
  else if (m === 'fromjson') $('#mode').value = 'format';
  lastMode = $('#mode').value;
  run();
  input.focus();
});
$('#goto').addEventListener('click', () => {
  input.focus();
  input.setSelectionRange(at, Math.min(at + 1, input.value.length));
});
$('#copy').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  try {
    await navigator.clipboard.writeText(out.value);
    b.textContent = 'Copied';
  } catch {
    out.select();
    b.textContent = document.execCommand?.('copy') ? 'Copied' : 'Press Ctrl+C';
  }
  setTimeout(() => (b.textContent = 'Copy'), 1500);
});
run();
