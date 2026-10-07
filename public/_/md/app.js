import { $, mountBar } from '/_/ui.js';
import { render } from './lib.js';
mountBar('Markdown');
const KEY = 'md-draft';
const SAMPLE = `# Release notes

Write **Markdown** on the left; the preview updates as you type. Supports *italic*, ~~strikethrough~~, \`inline code\` and [links](https://6o2f.dev).

## Checklist

1. Draft the post
2. Review
   - check the links
   - check the tables
3. Publish

- [x] Spell-check
- [ ] Add screenshots

> Raw HTML such as <b onclick="alert(1)">this</b> is shown as text, never run.

| Tool | Runs where |
|:-----|-----------:|
| md   | your browser |
| lorem | your browser |

\`\`\`js
const greet = (name) => \`hello, \${name}\`;
\`\`\`

---

![diagram](https://example.com/diagram.png) is shown as a link.
`;
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
    } catch {}
  },
};
const src = $('#src'),
  msg = $('#msg');
src.value = store.get() ?? SAMPLE; // an empty saved draft stays empty (Clear)
// Preview headings sit under the page's h1: shift each level down one (h1 -> h2 styled as h1), so the page keeps a single h1.
const run = () => {
  $('#out').innerHTML = src.value.trim()
    ? render(src.value).replace(/<(\/?)h([1-6])>/g, (_, s, n) => (s ? `</h${Math.min(6, +n + 1)}>` : `<h${Math.min(6, +n + 1)} class="l${n}">`))
    : '<p class="muted">Nothing to preview. Write some Markdown on the left.</p>';
}; // render() escapes all input and emits only its own tags
src.addEventListener('input', () => {
  run();
  store.set(src.value);
});
$('#clear').addEventListener('click', () => {
  src.value = '';
  run();
  store.set('');
  src.focus();
});
$('#reset').addEventListener('click', () => {
  src.value = SAMPLE;
  run();
  store.set(SAMPLE);
});
async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = `Copied ${what}.`;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    msg.textContent = ok ? `Copied ${what}.` : 'Copy blocked by the browser.';
  }
  setTimeout(() => (msg.textContent = ''), 2000);
}
$('#chtml').addEventListener('click', () => copy(render(src.value), 'HTML'));
$('#cmd').addEventListener('click', () => copy(src.value, 'Markdown'));
run();
