import { $, mountBar } from '/_/ui.js';
import { generate } from './lib.js';
mountBar('JSON to types');
const SAMPLE = {
  id: 'ord_8KJ2',
  number: 10423,
  status: 'paid',
  createdAt: '2026-10-01T09:30:00Z',
  deliverBy: '2026-10-06',
  customer: { id: 77, name: 'Ann Lee', email: 'ann@example.com', phone: null },
  items: [
    { sku: 'TEE-BLK-M', title: 'T-shirt', qty: 2, unitPrice: 24.5, tags: ['apparel'] },
    { sku: 'MUG-01', title: 'Mug', qty: 1, unitPrice: 12, giftWrap: true, tags: [] },
  ],
  shipping: { method: 'express', address: { line1: '1 George St', city: 'Sydney', postcode: '2000', country: 'AU' } },
  discounts: [],
  metadata: { source: 'web', 'utm-campaign': 'spring' },
};
const input = $('#in'),
  out = $('#out'),
  status = $('#status'),
  error = $('#error');
const LABEL = { ts: 'TypeScript', schema: 'JSON Schema', python: 'Python', go: 'Go' };
input.value = JSON.stringify(SAMPLE, null, 2);
function run() {
  const lang = $('#lang').value;
  document.querySelectorAll('[data-for]').forEach((e) => (e.hidden = !e.dataset.for.split(' ').includes(lang)));
  $('#outlabel').textContent = LABEL[lang];
  error.textContent = '';
  if (!input.value.trim()) {
    out.value = '';
    status.textContent = 'Paste a sample JSON document above.';
    return;
  }
  let v;
  try {
    v = JSON.parse(input.value);
  } catch (e) {
    const p = /position (\d+)/.exec(e.message),
      m = /line (\d+) column (\d+)/.exec(e.message);
    let where = m ? ` (line ${m[1]}, column ${m[2]})` : '';
    if (!m && p) {
      const b = input.value.slice(0, +p[1]);
      where = ` (line ${b.split('\n').length}, column ${+p[1] - b.lastIndexOf('\n')})`;
    }
    out.value = '';
    status.textContent = '';
    error.textContent = `Invalid JSON: ${e.message.replace(/ in JSON at.*| \(line.*/, '')}${where}`;
    return;
  }
  out.value = generate(v, {
    lang,
    rootName: $('#root').value.trim() || 'Root',
    style: $('#style').value,
    py: $('#py').value,
    readonly: $('#readonly').checked,
    dates: $('#dates').checked,
  });
  const n =
    lang === 'schema'
      ? Object.keys(JSON.parse(out.value).$defs ?? {}).length + 1
      : (out.value.match(/^(export (interface|type)|class |type |\w+ = )/gm) ?? []).length;
  status.textContent = `${n} type${n === 1 ? '' : 's'} generated.`;
}
let t;
for (const el of [input, $('#root')])
  el.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(run, input.value.length > 300000 ? 300 : 80);
  });
for (const id of ['lang', 'style', 'py', 'readonly', 'dates']) $('#' + id).addEventListener('change', run);
$('#clear').addEventListener('click', () => {
  input.value = '';
  run();
  input.focus();
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
