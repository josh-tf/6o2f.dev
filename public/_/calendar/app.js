import { $, esc, mountBar } from '/_/ui.js';
import { monthRows, isoWeek, isoWeekday, isoWeekDate, dayOfYear, dayNum, fromDayNum, iso, parse, isLeap, weeksInYear, daysInMonth } from './lib.js';
mountBar('Calendar');
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WD = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const t = new Date(),
  today = { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() },
  todayN = dayNum(today);
const store = {
  get: (k) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k, v) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};
let year = today.y,
  sel = today,
  ws = store.get('cal-ws') === '0' ? 0 : 1;
document.querySelector(`input[name=ws][value="${ws}"]`).checked = true;

let msgT;
async function copy(text) {
  const say = (m) => {
    $('#msg').textContent = m;
    clearTimeout(msgT);
    msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
  };
  try {
    await navigator.clipboard.writeText(text);
    say(`Copied ${text}`);
  } catch {
    const x = document.createElement('textarea');
    x.value = text;
    document.body.append(x);
    x.select();
    const ok = document.execCommand?.('copy');
    x.remove();
    say(ok ? `Copied ${text}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.');
  }
}
const label = (f) => `${WD[isoWeekday(f) - 1]} ${f.d} ${MON[f.m - 1]} ${f.y}`;

function render() {
  $('#year').value = year;
  $('#h-year').textContent = `${year}${isLeap(year) ? ' (leap year)' : ''} · ${weeksInYear(year)} ISO weeks`;
  const order = ws === 1 ? [0, 1, 2, 3, 4, 5, 6] : [6, 0, 1, 2, 3, 4, 5]; // indexes into WD
  const head = `<thead><tr><th scope="col" class="wk"><abbr title="ISO week number">Wk</abbr></th>${order.map((i) => `<th scope="col" class="${i > 4 ? 'we' : ''}"><abbr title="${WD[i]}">${WD[i].slice(0, 2)}</abbr></th>`).join('')}</tr></thead>`;
  $('#cal').innerHTML = MON.map((name, mi) => {
    const rows = monthRows(year, mi + 1, ws)
      .map(
        (r) =>
          `<tr><th scope="row" class="wk"><span class="vh">Week </span>${r.week}</th>${r.days
            .map((f, i) => {
              const we = order[i] > 4 ? ' we' : '';
              if (!f) return `<td class="pad${we}"></td>`;
              const n = dayNum(f),
                cur = n === todayN;
              return `<td class="${we.trim()}"><button type="button" tabindex="-1" data-n="${n}" aria-label="${label(f)}${cur ? ', today' : ''}"${cur ? ' aria-current="date"' : ''}>${f.d}</button></td>`;
            })
            .join('')}</tr>`,
      )
      .join('');
    return `<table><caption>${name} <span class="vh">${year}</span></caption>${head}<tbody>${rows}</tbody></table>`;
  }).join('');
  select(sel, false);
}

function select(f, focus = true) {
  if (f.y !== year) {
    year = f.y;
    sel = f;
    render();
    if (focus) select(f);
    return;
  }
  sel = f;
  const n = dayNum(f);
  for (const b of document.querySelectorAll('#cal button[aria-pressed]')) b.removeAttribute('aria-pressed');
  for (const b of document.querySelectorAll('#cal button[tabindex="0"]')) b.tabIndex = -1;
  const btn = $(`#cal button[data-n="${n}"]`);
  if (btn) {
    btn.tabIndex = 0;
    btn.setAttribute('aria-pressed', 'true');
    if (focus) btn.focus();
  }
  const w = isoWeek(f),
    rel = n - todayN;
  const rows = [
    ['ISO date', iso(f)],
    ['Weekday', WD[isoWeekday(f) - 1]],
    ['Day of year', `${dayOfYear(f)} of ${isLeap(f.y) ? 366 : 365}`],
    ['ISO week', `${w.week} of ${w.year} (${isoWeekDate(f)})`],
    [
      'From today',
      rel === 0
        ? 'Today'
        : rel > 0
          ? `In ${rel.toLocaleString('en')} day${rel === 1 ? '' : 's'}`
          : `${(-rel).toLocaleString('en')} day${rel === -1 ? '' : 's'} ago`,
    ],
  ];
  $('#info').innerHTML =
    `<p class="big"><time datetime="${iso(f)}">${esc(label(f))}</time></p><dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)} <button type="button" class="cp" data-c="${esc(v)}" aria-label="Copy ${k}">Copy</button></dd></div>`).join('')}</dl>`;
}

const setYear = (y) => {
  if (!Number.isInteger(y) || y < 1 || y > 9999) {
    $('#year').value = year;
    return;
  }
  year = y;
  sel = { y, m: sel.m, d: Math.min(sel.d, daysInMonth(y, sel.m)) };
  render();
};
$('#prev').addEventListener('click', () => setYear(year - 1));
$('#next').addEventListener('click', () => setYear(year + 1));
$('#year').addEventListener('change', () => setYear(Number($('#year').value)));
$('#year').addEventListener('input', () => {
  const y = Number($('#year').value);
  if (y >= 1000 && y <= 9999 && Number.isInteger(y) && y !== year) setYear(y);
});
$('#today').addEventListener('click', () => {
  year = today.y;
  sel = today;
  render();
  select(today);
});
document.querySelectorAll('input[name=ws]').forEach((r) =>
  r.addEventListener('change', () => {
    ws = Number(r.value);
    store.set('cal-ws', String(ws));
    render();
  }),
);
const jump = () => {
  const f = parse($('#jump').value);
  $('#jerr').textContent = f ? '' : 'Pick a complete date to jump to.';
  if (f) select(f);
};
$('#go').addEventListener('click', jump);
$('#jump').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') jump();
});
$('#print').addEventListener('click', () => print());
$('#cal').addEventListener('click', (e) => {
  const n = e.target.closest('button[data-n]')?.dataset.n;
  if (n) select(fromDayNum(Number(n)));
});
$('#info').addEventListener('click', (e) => {
  const c = e.target.closest('[data-c]')?.dataset.c;
  if (c) copy(c);
});
$('#cal').addEventListener('keydown', (e) => {
  if (!e.target.matches('button[data-n]')) return;
  const n = dayNum(sel),
    wd = (isoWeekday(sel) - ws + 7) % 7; // 0 = first column
  const addM = (k) => {
    const t = sel.y * 12 + sel.m - 1 + k,
      y = Math.floor(t / 12),
      m = t - y * 12 + 1;
    return { y, m, d: Math.min(sel.d, daysInMonth(y, m)) };
  };
  const to = {
    ArrowLeft: () => fromDayNum(n - 1),
    ArrowRight: () => fromDayNum(n + 1),
    ArrowUp: () => fromDayNum(n - 7),
    ArrowDown: () => fromDayNum(n + 7),
    Home: () => fromDayNum(n - wd),
    End: () => fromDayNum(n + 6 - wd),
    PageUp: () => addM(e.shiftKey ? -12 : -1),
    PageDown: () => addM(e.shiftKey ? 12 : 1),
  }[e.key];
  if (!to) return;
  e.preventDefault();
  const f = to();
  if (f.y >= 1 && f.y <= 9999) select(f);
});
document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return; // the grid handled it (its button may be gone after a re-render)
  if (e.target.closest('input,select,textarea,#cal')) return;
  e.preventDefault();
  setYear(year + (e.key === 'ArrowLeft' ? -1 : 1));
});
render();
