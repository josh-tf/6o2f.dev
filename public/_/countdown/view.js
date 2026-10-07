import { $ } from '/_/ui.js';
import { ics, slug, spoken, when } from './lib.js';
import { drawClock, everySecond } from './clock.js';

const id = location.pathname.split('/').pop();
const myTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
let lastSpoken = 0;

async function main() {
  let ev;
  try {
    const r = await fetch(`/api/event/${encodeURIComponent(id)}`);
    ev = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(ev.error || r.statusText);
  } catch (e) {
    $('#title').textContent = 'Countdown not found';
    $('#err').textContent = `${e.message}. Check the link, or the countdown may have been deleted.`;
    return;
  }
  $('#title').textContent = ev.title;
  document.title = `${ev.title} · Countdown`;
  $('#live').hidden = false;
  const iso = new Date(ev.target).toISOString();
  $('#local').dateTime = iso;
  $('#local').textContent = when(ev.target);
  if (ev.tz && ev.tz !== myTz) {
    $('#tzlabel').hidden = $('#tzrow').hidden = false;
    $('#tzlabel').textContent = `Event time (${ev.tz.replace(/_/g, ' ')})`;
    $('#zoned').dateTime = iso;
    $('#zoned').textContent = when(ev.target, ev.tz);
  }
  const url = location.href.split('#')[0];
  const file = new Blob([ics({ ...ev, url })], { type: 'text/calendar' });
  $('#ics').href = URL.createObjectURL(file);
  $('#ics').download = `${slug(ev.title)}.ics`;
  $('#copy').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(url);
      $('#st').textContent = 'Link copied.';
    } catch {
      $('#st').textContent = `Copy blocked. The link is: ${url}`;
    }
  });
  everySecond(() => {
    const ms = ev.target - Date.now();
    const p = drawClock($('#clock'), ms);
    // The visually hidden description is refreshed once a minute so screen readers can read it on demand without chatter.
    if (Date.now() - lastSpoken > 60_000 || p.done) {
      $('#spoken').textContent = `${spoken(ms)} left until ${when(ev.target)}`;
      lastSpoken = Date.now();
    }
    if (p.done) {
      $('#clock').hidden = true;
      $('#done').hidden = false;
      $('#message').textContent = ev.message || '';
      $('#message').hidden = !ev.message;
      document.title = `${ev.title} · Now`;
      return false;
    }
  });
}
main();
