import { $, api, mountBar } from '/_/ui.js';
mountBar('AI Helper');
const LABEL = {
  rewrite: 'Text to rewrite',
  grammar: 'Text to correct',
  summarise: 'Text to summarise',
  translate: 'Text to translate',
  explain: 'Code to explain',
};
const mode = () => document.querySelector('input[name=mode]:checked').value;
const out = $('#out'),
  text = $('#text');
let ctl = null,
  result = '';

function syncMode() {
  const m = mode();
  document.querySelectorAll('.opts [data-for]').forEach((d) => (d.hidden = d.dataset.for !== m));
  $('#textlabel').textContent = LABEL[m];
  text.spellcheck = m !== 'explain';
}
document.querySelectorAll('input[name=mode]').forEach((r) => r.addEventListener('change', syncMode));
const count = () => {
  const n = text.value.length;
  $('#count').textContent = `${n.toLocaleString()} / 8,000 characters`;
};
text.addEventListener('input', count);

function showUsage(u) {
  if (!u) return;
  const reset = new Date(u.resetsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  $('#usage').textContent = `${u.remaining} of ${u.limit} requests left today (resets ${reset} your time).`;
}
async function loadUsage() {
  try {
    const u = await api('/api/usage');
    showUsage(u);
    if (!$('#lang').options.length) $('#lang').append(...u.languages.map((l) => new Option(l, l)));
  } catch (e) {
    $('#usage').textContent = `Usage unavailable: ${e.message}`;
  }
}

function busy(on) {
  $('#run').disabled = on;
  $('#stop').hidden = !on;
  out.setAttribute('aria-busy', String(on));
  $('#copy').disabled = $('#use').disabled = on || !result;
}

async function run() {
  $('#err').textContent = '';
  if (!text.value.trim()) {
    $('#err').textContent = 'Enter some text first.';
    text.focus();
    return;
  }
  if (ctl) return;
  ctl = new AbortController();
  result = '';
  out.textContent = '';
  busy(true);
  $('#st').textContent = 'Working…';
  try {
    const r = await fetch('/api/run', {
      method: 'POST',
      signal: ctl.signal,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode: mode(), text: text.value, tone: $('#tone').value, length: $('#length').value, lang: $('#lang').value }),
    });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      throw new Error(d.error || `${r.status} ${r.statusText}`);
    }
    const reader = r.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += value;
      const events = buf.split('\n\n');
      buf = events.pop();
      for (const ev of events) {
        const data = ev
          .split('\n')
          .filter((l) => l.startsWith('data:'))
          .map((l) => l.slice(5).trim())
          .join('');
        if (!data || data === '[DONE]') continue;
        try {
          const j = JSON.parse(data);
          result += j.response ?? j.choices?.[0]?.delta?.content ?? '';
        } catch {}
      }
      out.textContent = result;
    }
    result = result.trim();
    out.textContent = result || 'The model returned nothing. Try rephrasing or a different mode.';
    $('#st').textContent = 'Done.';
    loadUsage();
  } catch (e) {
    if (e.name === 'AbortError') $('#st').textContent = 'Stopped.';
    else {
      $('#st').textContent = '';
      $('#err').textContent = e.message;
      if (!result) out.textContent = '';
    }
  } finally {
    ctl = null;
    busy(false);
  }
}
$('#f').addEventListener('submit', (e) => {
  e.preventDefault();
  run();
});
text.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    run();
  }
});
$('#stop').addEventListener('click', () => ctl?.abort());
$('#clear').addEventListener('click', () => {
  text.value = '';
  count();
  text.focus();
});
$('#use').addEventListener('click', () => {
  text.value = result;
  count();
  text.focus();
});
$('#copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(result);
    $('#st').textContent = 'Copied to clipboard.';
  } catch {
    const r = document.createRange();
    r.selectNodeContents(out);
    getSelection().removeAllRanges();
    getSelection().addRange(r);
    $('#st').textContent = document.execCommand?.('copy') ? 'Copied to clipboard.' : 'Copy blocked: the text is selected, press Ctrl+C.';
  }
});
syncMode();
count();
loadUsage();
