import { $, mountBar } from '/_/ui.js';
import { parse, parseTree, render, toPaths, count } from './lib.js';
mountBar('Tree');

const EX = {
  make: 'src/index.ts            # Worker entry\nsrc/routes/api.ts\nsrc/routes/pages.ts\nsrc/lib/db.ts           # D1 helpers\npublic/favicon.svg\npublic/app.css\nmigrations/0001_init.sql\ntests/api.test.ts\npackage.json\nREADME.md\nwrangler.jsonc          # bindings',
  rev: '.\n├── src\n│   ├── index.ts            # Worker entry\n│   ├── lib\n│   │   └── db.ts\n│   └── routes\n│       ├── api.ts\n│       └── pages.ts\n├── public\n│   └── app.css\n├── package.json\n└── README.md\n\n4 directories, 7 files',
};
const typed = { make: null, rev: null };
let msgT;
async function copy(text, what) {
  const msg = $('#msg');
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = `Copied ${what}`;
  } catch {
    $('#out').select();
    msg.textContent = document.execCommand?.('copy') ? `Copied ${what}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  }
  clearTimeout(msgT);
  msgT = setTimeout(() => (msg.textContent = ''), 2500);
}
const mode = () => document.querySelector('[name=mode]:checked').value;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function run() {
  const m = mode(),
    text = $('#in').value;
  $('#err').textContent = '';
  if (!text.trim()) {
    $('#out').value = '';
    $('#stats').textContent = m === 'make' ? 'Type some paths to see the tree.' : 'Paste a tree to get its paths.';
    return;
  }
  try {
    if (m === 'make') {
      const { root, format, rootLabel } = parse(text, $('#fmt').value);
      const o = {
        style: $('#style').value,
        dirsFirst: $('#dirs').checked,
        sort: $('#sort').checked,
        slash: $('#slash').checked,
        comments: $('#cmt').checked,
        root: $('#root').value.trim() || rootLabel,
      };
      $('#out').value = render(root, o);
      const c = count(root);
      $('#stats').textContent =
        `${plural(c.dirs, 'folder')}, ${plural(c.files, 'file')}${$('#fmt').value === 'auto' ? ` · read as ${{ paths: 'paths', indent: 'an indented list', lsr: 'ls -R output', tree: 'a drawn tree' }[format]}` : ''}`;
    } else {
      const { root, rootLabel } = $('#fmt').value === 'auto' || $('#fmt').value === 'tree' ? parseTree(text) : parse(text, $('#fmt').value);
      const prefix = $('#prefix').checked && rootLabel && rootLabel !== '.' ? rootLabel : '';
      const paths = toPaths(root, { filesOnly: $('#files').checked, prefix, comments: $('#rcmt').checked });
      $('#out').value = paths.join('\n');
      const c = count(root);
      $('#stats').textContent = `${plural(paths.length, 'path')} (${plural(c.dirs, 'folder')}, ${plural(c.files, 'file')})`;
      if (!paths.length) $('#err').textContent = 'No entries found. A tree line looks like "├── name" or "|-- name".';
    }
  } catch (e) {
    $('#out').value = '';
    $('#err').textContent = e.message;
  }
  $('#out').rows = Math.min(40, Math.max(14, $('#out').value.split('\n').length + 1)); // show the whole tree without scrolling when it fits
}
function setMode() {
  const m = mode();
  $('#mopts').hidden = m !== 'make';
  $('#ropts').hidden = m !== 'rev';
  $('#inlabel').textContent = m === 'make' ? 'Paths, an indented list, or ls -R / find / tar -t output' : 'A drawn tree (from tree, or this tool)';
  $('#hint').hidden = m !== 'make';
  $('#in').value = typed[m] ?? EX[m];
  run();
}
document.querySelectorAll('[name=mode]').forEach((r) =>
  r.addEventListener('change', () => {
    typed[r.value === 'make' ? 'rev' : 'make'] = $('#in').value;
    setMode();
  }),
);
$('#in').addEventListener('input', run);
for (const id of ['#fmt', '#style', '#root', '#dirs', '#sort', '#slash', '#cmt', '#files', '#prefix', '#rcmt']) $(id).addEventListener('input', run);
$('#copy').addEventListener('click', () => copy($('#out').value, mode() === 'make' ? 'tree' : 'paths'));
$('#clear').addEventListener('click', () => {
  $('#in').value = '';
  run();
  $('#in').focus();
});
setMode();
