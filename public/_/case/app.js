import { $, mountBar } from '/_/ui.js';
import { CASES, convert } from './lib.js';
mountBar('Case');
const pres = CASES.map(([, label, fn]) => {
  const card = Object.assign(document.createElement('div'), { className: 'card' });
  const h = Object.assign(document.createElement('h2'), { textContent: label });
  const b = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Copy', ariaLabel: `Copy ${label}` });
  const pre = document.createElement('pre');
  const top = Object.assign(document.createElement('div'), { className: 'top' });
  top.append(h, b);
  card.append(top, pre);
  $('#outs').append(card);
  b.onclick = async () => {
    try {
      await navigator.clipboard.writeText(pre.textContent);
      b.textContent = 'Copied';
    } catch {
      getSelection().selectAllChildren(pre);
      b.textContent = 'Press Ctrl+C';
    }
    setTimeout(() => (b.textContent = 'Copy'), 1400);
  };
  return [pre, fn];
});
const run = () => pres.forEach(([pre, fn]) => (pre.textContent = convert(fn, $('#in').value)));
$('#in').value = 'HTTPServer error: the quick brown fox\nparseXML2Json-v2 is user_friendly';
$('#in').addEventListener('input', run);
run();
