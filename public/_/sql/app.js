import { $, mountBar } from '/_/ui.js';
import { format, minify, statements } from './lib.js';
mountBar('SQL');
const SAMPLE = `-- Top customers in the last 30 days
with recent as (select o.id, o.customer_id, o.total from orders o where o.created_at >= now() - interval '30 days' and o.status <> 'cancelled'),
spend as (select customer_id, sum(total) as spent, count(*) as n from recent group by customer_id having sum(total) > 100)
select c.name, c."E-mail", s.spent, case when s.spent > 1000 then 'gold' when s.spent > 500 then 'silver' else 'bronze' end as tier
from spend s left join customers c on c.id = s.customer_id and c.deleted_at is null
where c.country in ('AU', 'NZ') and s.n between 2 and 50 /* exclude test accounts */ and c.email not like '%@example.com'
order by s.spent desc limit 20;
update customers set tier = 'gold', note = 'it''s -- not a comment; really' where id in (select customer_id from spend where spent > 1000);`;
const input = $('#in'),
  out = $('#out'),
  status = $('#status'),
  error = $('#error');
let at = 0;
input.value = SAMPLE;
const IND = { 2: '  ', 4: '    ', tab: '\t' };
function run() {
  error.hidden = true;
  const src = input.value,
    dialect = $('#dialect').value,
    minifying = $('#mode').value === 'minify';
  for (const id of ['indent', 'kcase', 'comma']) $('#' + id).disabled = minifying;
  if (!src.trim()) {
    out.value = '';
    status.textContent = 'Paste SQL above to format or minify it.';
    return;
  }
  try {
    out.value = minifying
      ? minify(src, { dialect })
      : format(src, { indent: IND[$('#indent').value], keywordCase: $('#kcase').value, commaFirst: $('#comma').value === 'first', dialect });
    const n = statements(src, dialect),
      a = new Blob([src]).size,
      b = new Blob([out.value]).size;
    status.textContent = `${n} statement${n === 1 ? '' : 's'}. ${a.toLocaleString()} B in, ${b.toLocaleString()} B out.`;
  } catch (e) {
    out.value = '';
    status.textContent = '';
    at = e.at ?? 0;
    $('#errmsg').textContent = `Can't read this SQL: ${e.message}.`;
    error.hidden = false;
  }
}
let t;
input.addEventListener('input', () => {
  clearTimeout(t);
  t = setTimeout(run, input.value.length > 100000 ? 300 : 60);
});
for (const id of ['mode', 'indent', 'kcase', 'comma', 'dialect']) $('#' + id).addEventListener('change', run);
$('#clear').addEventListener('click', () => {
  input.value = '';
  run();
  input.focus();
});
$('#swap').addEventListener('click', () => {
  if (!out.value) return;
  input.value = out.value;
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
