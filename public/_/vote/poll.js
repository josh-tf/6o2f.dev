import { $ } from '/_/ui.js';
import { renderBars, votesText } from '/_/vote/bars.js';

const id = location.pathname.split('/').pop();
const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
let poll;

async function call(path, init) {
  const r = await fetch(path, init);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || r.statusText);
  return data;
}
// #info is a live region polled every 10 s: only touch it when the text really changes, so screen readers stay quiet.
const setInfo = (t) => {
  if ($('#info').textContent !== t) $('#info').textContent = t;
};
function show() {
  $('#q').textContent = poll.question;
  document.title = `${poll.question} · Poll`;
  let info = poll.open
    ? `Open until ${fmt.format(poll.closesAt)}.${poll.multi ? ' Choose as many as you like.' : ''}`
    : `This poll closed on ${fmt.format(poll.closesAt)}.`;
  const ballot = !poll.open ? false : !poll.voted;
  $('#ballot').hidden = !ballot;
  if (poll.open && poll.voted) info += ' You have voted. Thank you.';
  if (ballot && !$('#choices input')) {
    $('#legend').textContent = poll.multi ? 'Choose one or more' : 'Choose one';
    poll.options.forEach((label, i) => {
      const l = document.createElement('label');
      l.className = 'choice';
      const inp = document.createElement('input');
      inp.type = poll.multi ? 'checkbox' : 'radio';
      inp.name = 'c';
      inp.value = i;
      l.append(inp, label);
      $('#choices').append(l);
    });
  }
  const r = poll.results;
  $('#res').hidden = !r;
  if (r) {
    renderBars($('#bars'), poll.options, r);
    $('#total').textContent = votesText(r.voters);
  } else if (poll.open) info += ' Results appear when the poll closes.';
  setInfo(info);
}
async function load() {
  try {
    poll = await call(`/api/poll/${id}`);
    $('#err').textContent = '';
    show();
  } catch (e) {
    if (poll) {
      $('#err').textContent = `Could not refresh: ${e.message}`;
      return;
    } // keep the loaded poll on a network blip
    $('#q').textContent = e.message === 'Poll not found' ? 'Poll not found' : 'Could not load this poll';
    setInfo(e.message === 'Poll not found' ? 'Check the link: the poll may have been deleted.' : '');
    if (e.message !== 'Poll not found') $('#err').textContent = e.message;
  }
}
$('#ballot').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#err').textContent = '';
  const choices = [...document.querySelectorAll('#choices input:checked')].map((x) => Number(x.value));
  if (!choices.length) {
    $('#err').textContent = 'Pick an option first';
    return;
  }
  try {
    await call(`/api/poll/${id}/vote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ choices }) });
  } catch (x) {
    $('#err').textContent = x.message;
  }
  await load();
});
await load();
setInterval(() => !document.hidden && poll?.open && load(), 10000);
