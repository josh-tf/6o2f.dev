import { $, api, mountBar } from '/_/ui.js';
import { renderBars, votesText } from '/_/vote/bars.js';
await mountBar('Polls');

const opts = $('#opts');
const lines = () =>
  opts.value
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);
const updCount = () => {
  const n = lines().length;
  $('#optcount').textContent = `${n} option${n === 1 ? '' : 's'}${n < 2 ? ' (need at least 2)' : n > 10 ? ' (max 10)' : ''}`;
};
opts.addEventListener('input', updCount);
updCount();

const fmt = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const link = (id) => `${location.origin}/p/${id}`;
let confirming = null; // poll id awaiting delete confirmation

async function copy(text, btn) {
  const old = btn.textContent;
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch {
    const i = btn.parentElement.querySelector('input');
    i.select();
    btn.textContent = document.execCommand('copy') ? 'Copied' : 'Press Ctrl+C';
  }
  setTimeout(() => (btn.textContent = old), 1500);
}

function card(p) {
  const li = document.createElement('li');
  li.className = 'card poll';
  li.dataset.id = p.id;
  const h = document.createElement('h3');
  h.textContent = p.question;
  const meta = document.createElement('p');
  meta.className = 'meta';
  const tag = document.createElement('span');
  tag.className = `tag${p.open ? ' open' : ''}`;
  tag.textContent = p.open ? 'Open' : 'Closed';
  const t = document.createElement('time');
  t.dateTime = new Date(p.closesAt).toISOString();
  t.textContent = fmt.format(p.closesAt);
  meta.append(
    tag,
    `${votesText(p.results.voters)} · ${p.open ? 'closes' : 'closed'} `,
    t,
    p.multi ? ' · multiple choice' : '',
    p.showResults ? '' : ' · results hidden from voters',
  );
  const bars = document.createElement('ul');
  bars.className = 'bars';
  bars.setAttribute('aria-label', `Results for ${p.question}`);
  renderBars(bars, p.options, p.results);
  const share = document.createElement('div');
  share.className = 'share';
  const lab = document.createElement('label');
  lab.className = 'vh';
  lab.htmlFor = `l-${p.id}`;
  lab.textContent = `Share link for ${p.question}`;
  const inp = document.createElement('input');
  inp.id = `l-${p.id}`;
  inp.readOnly = true;
  inp.value = link(p.id);
  inp.autocomplete = 'off';
  inp.spellcheck = false;
  inp.addEventListener('focus', () => inp.select());
  const cp = Object.assign(document.createElement('button'), { type: 'button', textContent: 'Copy link' });
  cp.addEventListener('click', () => copy(inp.value, cp));
  const open = Object.assign(document.createElement('a'), {
    className: 'btn',
    href: link(p.id),
    target: '_blank',
    rel: 'noopener noreferrer',
    textContent: 'Open',
  });
  share.append(lab, inp, cp, open);
  const act = document.createElement('div');
  act.className = 'row';
  if (p.open)
    act.append(
      Object.assign(document.createElement('button'), {
        type: 'button',
        textContent: 'Close now',
        onclick: () => run(`/api/polls/${p.id}/close`, 'POST', 'Poll closed'),
      }),
    );
  if (confirming === p.id) {
    const s = document.createElement('span');
    s.textContent = 'Delete this poll and its votes?';
    const y = Object.assign(document.createElement('button'), {
      type: 'button',
      className: 'danger',
      textContent: 'Yes, delete',
      onclick: () => {
        confirming = null;
        run(`/api/polls/${p.id}`, 'DELETE', 'Poll deleted');
      },
    });
    const n = Object.assign(document.createElement('button'), {
      type: 'button',
      textContent: 'Cancel',
      onclick: () => {
        confirming = null;
        load();
      },
    });
    act.append(s, y, n);
  } else
    act.append(
      Object.assign(document.createElement('button'), {
        type: 'button',
        className: 'danger',
        textContent: 'Delete',
        onclick: () => {
          confirming = p.id;
          load().then(() => $(`[data-id="${p.id}"] .danger`)?.focus());
        },
      }),
    );
  li.append(h, meta, bars, share, act);
  return li;
}

async function load() {
  try {
    const polls = await api('/api/polls');
    $('#list').replaceChildren(...polls.map(card));
    $('#empty').hidden = polls.length > 0;
    $('#count').textContent = polls.length ? `(${polls.length} of 50)` : '';
  } catch (e) {
    $('#status').textContent = `Could not load polls: ${e.message}`;
  }
}
async function run(path, method, done) {
  try {
    await api(path, { method });
    $('#status').textContent = done;
  } catch (e) {
    $('#status').textContent = e.message;
  }
  load();
}

$('#new').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#msg').textContent = '';
  const n = lines().length;
  if (n < 2 || n > 10) {
    $('#msg').textContent = 'Give 2 to 10 options';
    return;
  }
  try {
    const { id } = await api('/api/polls', {
      method: 'POST',
      body: { question: $('#q').value, options: lines(), multi: $('#multi').checked, showResults: $('#show').checked, days: Number($('#days').value) },
    });
    $('#status').textContent = 'Poll created. Share its link below.';
    await load();
    $(`[data-id="${id}"] input`)?.focus();
  } catch (x) {
    $('#msg').textContent = x.message;
  }
});
load();
// Refresh counts, but never rebuild the list under the keyboard focus (it would drop focus to <body>).
setInterval(() => !document.hidden && !confirming && !$('#list').contains(document.activeElement) && load(), 15000);
