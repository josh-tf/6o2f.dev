import { $, esc, mountBar } from '/_/ui.js';
import {
  ENCODINGS,
  encodeText,
  decodeText,
  parseHex,
  parseBinary,
  parseDecimal,
  toHex,
  toPlain,
  toBinary,
  toDecimal,
  toCArray,
  toBase64,
  dumpRows,
  dumpText,
  search,
  inspect,
} from './lib.js';
mountBar('Hex');

const MAX = 1 << 20,
  PREVIEW = 1024;
let bytes = new Uint8Array(0),
  file = null,
  sel = { a: 0, b: 1 },
  anchor = 0,
  page = 0,
  hits = [],
  hitLen = 0;
const width = () => +$('#width').value;
const PAGE = () => width() * 64;
const kind = () => document.querySelector('[name=kind]:checked').value;
const hx = (n) => '0x' + n.toString(16).padStart(4, '0');

let msgT;
async function copy(text, what) {
  const msg = $('#msg');
  try {
    await navigator.clipboard.writeText(text);
    msg.textContent = `Copied ${what}`;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    msg.textContent = ok ? `Copied ${what}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  }
  clearTimeout(msgT);
  msgT = setTimeout(() => (msg.textContent = ''), 2500);
}

$('#enc').innerHTML = ENCODINGS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
const HINT = {
  text: 'Typed text is encoded with the chosen encoding.',
  hex: 'Accepts 48 65 6c, 48656c, 0x48656c, xxd -p, 0x48, \\x48, C arrays, and xxd or hexdump -C dumps.',
  bin: 'Bytes of 8 bits, separated by spaces (01001000 01101001) or run together.',
  dec: 'Numbers 0 to 255 separated by spaces or commas; brackets and braces are ignored.',
};
const LABEL = { text: 'Text', hex: 'Hex bytes', bin: 'Binary bytes', dec: 'Decimal bytes' };

function read() {
  $('#err').textContent = '';
  $('#in').removeAttribute('aria-invalid');
  if (file) return;
  const s = $('#in').value,
    k = kind();
  try {
    bytes = k === 'text' ? encodeText(s, $('#enc').value) : k === 'hex' ? parseHex(s) : k === 'bin' ? parseBinary(s) : parseDecimal(s);
  } catch (e) {
    $('#err').textContent = e.message;
    $('#in').setAttribute('aria-invalid', 'true');
    bytes = new Uint8Array(0);
  }
  if (bytes.length > MAX) {
    bytes = bytes.slice(0, MAX);
    $('#err').textContent = 'Input is over 1 MB; only the first 1 MB is shown.';
  }
  after();
}
function after() {
  sel.a = Math.min(sel.a, Math.max(0, bytes.length - 1));
  sel.b = Math.min(Math.max(sel.b, sel.a + 1), Math.max(1, bytes.length));
  page = Math.min(page, Math.max(0, Math.ceil(bytes.length / PAGE()) - 1));
  $('#size').textContent = `${bytes.length.toLocaleString()} byte${bytes.length === 1 ? '' : 's'}`;
  findAll(false);
  draw();
  convert();
}

function draw() {
  const w = width(),
    start = page * PAGE(),
    end = Math.min(bytes.length, start + PAGE());
  const hit = new Set();
  for (const h of hits) if (h + hitLen > start && h < end) for (let i = h; i < h + hitLen; i++) hit.add(i);
  if (!bytes.length) $('#dump').innerHTML = '<p class="empty">No bytes yet. Type or paste above, or open a file.</p>';
  else
    $('#dump').innerHTML = dumpRows(bytes, w, start, end)
      .map((r) => {
        const cls = (i) => (i >= sel.a && i < sel.b ? 'sel' : hit.has(i) ? 'hit' : '');
        const hexs = r.bytes
          .map((x, j) => {
            const i = r.offset + j;
            return `<span data-i="${i}" class="${cls(i)}${j && j % 8 === 0 ? ' g' : ''}${x ? '' : ' z'}">${x.toString(16).padStart(2, '0')}</span>`;
          })
          .join('');
        let pad = '';
        for (let j = r.bytes.length; j < w; j++) pad += `<span class="pad${j % 8 === 0 ? ' g' : ''}" aria-hidden="true">  </span>`;
        const asc = [...r.ascii].map((c, j) => `<span data-i="${r.offset + j}" class="${cls(r.offset + j)}">${esc(c)}</span>`).join('');
        return `<div class="r"><span class="o">${r.offset.toString(16).padStart(8, '0')}</span><span class="h">${hexs}${pad}</span><span class="a">${asc}</span></div>`;
      })
      .join('');
  const pages = Math.max(1, Math.ceil(bytes.length / PAGE()));
  $('#pginfo').textContent = bytes.length ? `${hx(start)}–${hx(Math.max(start, end - 1))} · page ${page + 1} of ${pages}` : '';
  $('#pgprev').disabled = page === 0;
  $('#pgnext').disabled = page >= pages - 1;
  $('#cdump').disabled = !bytes.length;
  inspector();
}

function inspector() {
  const n = sel.b - sel.a;
  $('#selout').textContent = bytes.length
    ? `Selected offset ${hx(sel.a)} (${sel.a})${n > 1 ? `, ${n} bytes to ${hx(sel.b - 1)}` : ''}: ${toHex(bytes.subarray(sel.a, Math.min(sel.b, sel.a + 32)))}${n > 32 ? ' …' : ''}`
    : 'Nothing selected.';
  const rows = bytes.length ? inspect(bytes, sel.a) : [];
  $('#insp tbody').innerHTML = rows.length
    ? rows
        .map(
          (r) =>
            `<tr><th scope="row">${r.name}</th>${r.le === null ? `<td class="na" colspan="2">needs ${r.size} bytes</td>` : r.size === 1 ? `<td colspan="2">${r.le}</td>` : `<td>${r.le}</td><td>${r.be}</td>`}</tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="na">Select a byte in the dump.</td></tr>';
}

const conv = new Map();
function convert() {
  const src = $('#onlysel').checked ? bytes.subarray(sel.a, sel.b) : bytes;
  const dec = decodeText(src, $('#enc').value);
  const encName = ENCODINGS.find((e) => e[0] === $('#enc').value)[1];
  const enc = $('#enc').value;
  const list = [
    ['hex', 'Hex', toHex],
    ['plain', 'Hex (xxd -p)', toPlain],
    ['bin', 'Binary', toBinary],
    ['dec', 'Decimal', toDecimal],
    [
      'text',
      `Text (${encName})`,
      (b) => decodeText(b, enc).text,
      dec.bad ? `${dec.bad} byte sequence${dec.bad === 1 ? '' : 's'} could not be decoded and show as \ufffd.` : '',
    ],
    ['c', 'C array', toCArray],
    ['b64', 'Base64', toBase64],
  ];
  conv.clear();
  $('#conv tbody').innerHTML = list
    .map(([id, name, fn, note]) => {
      conv.set(id, () => fn(src));
      const full = fn(src.length > PREVIEW ? src.subarray(0, PREVIEW) : src),
        cut = full.length > 600;
      let v = cut ? full.slice(0, 600) + ' …' : full;
      if (id === 'text') v = v.replace(/[\x00-\x08\x0b-\x1f\x7f]/g, (c) => String.fromCharCode(c === '\x7f' ? 0x2421 : 0x2400 + c.charCodeAt(0))); // show control characters as ␀ ␛ …; Copy keeps the real ones
      const n = [note, cut ? `Preview; Copy takes all ${src.length.toLocaleString()} bytes.` : ''].filter(Boolean).join(' ');
      return `<tr><th scope="row">${esc(name)}</th><td class="v"><pre>${esc(v)}</pre>${n ? `<span class="note">${esc(n)}</span>` : ''}</td><td><button type="button" data-c="${id}" aria-label="Copy ${esc(name)}"${src.length ? '' : ' disabled'}>Copy</button></td></tr>`;
    })
    .join('');
}
$('#conv').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-c]');
  if (!b) return;
  copy(conv.get(b.dataset.c)(), b.getAttribute('aria-label').replace('Copy ', ''));
});

function select(a, b, scroll = true) {
  if (!bytes.length) return;
  sel = { a: Math.max(0, Math.min(a, bytes.length - 1)), b: Math.max(1, Math.min(b, bytes.length)) };
  if (sel.b <= sel.a) sel.b = sel.a + 1;
  const p = Math.floor(sel.a / PAGE());
  if (scroll && p !== page) page = p;
  draw();
  if ($('#onlysel').checked) convert();
  $(`#dump [data-i="${sel.a}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

$('#dump').addEventListener('click', (e) => {
  const t = e.target.closest('[data-i]');
  if (!t) return;
  const i = +t.dataset.i;
  if (e.shiftKey) select(Math.min(anchor, i), Math.max(anchor, i) + 1, false);
  else {
    anchor = i;
    select(i, i + 1, false);
  }
});
$('#dump').addEventListener('keydown', (e) => {
  const w = width(),
    d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -w, ArrowDown: w, PageUp: -PAGE(), PageDown: PAGE(), Home: -Infinity, End: Infinity }[e.key];
  if (d === undefined || !bytes.length) return;
  e.preventDefault();
  const head = sel.a === anchor ? sel.b - 1 : sel.a;
  const to = Math.max(0, Math.min(bytes.length - 1, d === -Infinity ? 0 : d === Infinity ? bytes.length - 1 : head + d));
  if (e.shiftKey) select(Math.min(anchor, to), Math.max(anchor, to) + 1);
  else {
    anchor = to;
    select(to, to + 1);
  }
});

function needle() {
  const q = $('#q').value;
  if (!q) return null;
  return $('#qkind').value === 'hex' ? parseHex(q) : encodeText(q, $('#enc').value);
}
function findAll(report = true) {
  let n;
  try {
    n = needle();
  } catch (e) {
    hits = [];
    $('#findmsg').textContent = `Search: ${e.message}`;
    return;
  }
  if (!n) {
    hits = [];
    hitLen = 0;
    if (report) $('#findmsg').textContent = '';
    return;
  }
  hits = search(bytes, n);
  hitLen = n.length;
  $('#findmsg').textContent = hits.length
    ? `${hits.length.toLocaleString()}${hits.length >= 10000 ? '+' : ''} match${hits.length === 1 ? '' : 'es'} for ${toHex(n.subarray(0, 16))}${n.length > 16 ? ' …' : ''}`
    : `No match for ${toHex(n.subarray(0, 16))}`;
}
function step(dir) {
  findAll();
  if (!hits.length) {
    draw();
    return;
  }
  let h = dir > 0 ? hits.find((x) => x > sel.a) : [...hits].reverse().find((x) => x < sel.a);
  if (h === undefined) h = dir > 0 ? hits[0] : hits.at(-1);
  anchor = h;
  select(h, h + hitLen);
  $('#findmsg').textContent += ` · match ${hits.indexOf(h) + 1} at ${hx(h)}`;
}
$('#findform').addEventListener('submit', (e) => {
  e.preventDefault();
  step(1);
});
$('#prev').addEventListener('click', () => step(-1));
$('#q').addEventListener('input', () => {
  findAll();
  draw();
});
$('#qkind').addEventListener('change', () => {
  findAll();
  draw();
});
$('#goform').addEventListener('submit', (e) => {
  e.preventDefault();
  const v = $('#go').value.trim(),
    n = /^0x[0-9a-f]+$/i.test(v) ? parseInt(v, 16) : /^\d+$/.test(v) ? +v : /^[0-9a-f]+h?$/i.test(v) ? parseInt(v, 16) : NaN;
  if (Number.isNaN(n)) {
    $('#findmsg').textContent = 'Offset must be a number: 0x1f (hex) or 31 (decimal).';
    return;
  }
  if (n >= bytes.length) {
    $('#findmsg').textContent = `Offset ${hx(n)} is past the end (${bytes.length} bytes).`;
    return;
  }
  anchor = n;
  select(n, n + 1);
  $('#dump').focus();
});
$('#pgprev').addEventListener('click', () => {
  page--;
  draw();
});
$('#pgnext').addEventListener('click', () => {
  page++;
  draw();
});
$('#cdump').addEventListener('click', () => copy(dumpText(bytes, width()), 'hex dump'));
$('#width').addEventListener('change', () => {
  page = Math.floor(sel.a / PAGE());
  draw();
});
$('#onlysel').addEventListener('change', convert);

function setKind(prev) {
  const k = kind();
  // convert what is there into the new representation so switching never loses data
  if (prev && !file && bytes.length && !$('#err').textContent) {
    $('#in').value = k === 'text' ? decodeText(bytes, $('#enc').value).text : k === 'hex' ? toHex(bytes) : k === 'bin' ? toBinary(bytes) : toDecimal(bytes);
  }
  $('#inlabel').textContent = LABEL[k];
  $('#inhint').textContent = HINT[k];
  read();
}
let prevKind = kind();
document.querySelectorAll('[name=kind]').forEach((r) =>
  r.addEventListener('change', () => {
    setKind(prevKind);
    prevKind = kind();
  }),
);
$('#enc').addEventListener('change', () => {
  if (kind() === 'text' && !file) read();
  else {
    convert();
    findAll();
    draw();
  }
});
let timer;
$('#in').addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(read, $('#in').value.length > 200000 ? 300 : 80);
});

async function openFile(f) {
  if (!f) return;
  file = f;
  bytes = new Uint8Array(await f.slice(0, MAX).arrayBuffer());
  $('#fname').textContent = `${f.name}: ${f.size.toLocaleString()} bytes${f.size > MAX ? ', showing the first 1,048,576' : ''}`;
  $('#fileinfo').hidden = false;
  $('#textwrap').hidden = true;
  $('#err').textContent = '';
  sel = { a: 0, b: 1 };
  anchor = 0;
  page = 0;
  after();
}
$('#file').addEventListener('change', () => openFile($('#file').files[0]));
$('#closefile').addEventListener('click', () => {
  file = null;
  $('#file').value = '';
  $('#fileinfo').hidden = true;
  $('#textwrap').hidden = false;
  read();
  $('#in').focus();
});
for (const el of [$('#in'), $('#fileinfo')]) {
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    el.classList.add('drag');
  });
  el.addEventListener('dragleave', () => el.classList.remove('drag'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drag');
    if (e.dataTransfer.files[0]) openFile(e.dataTransfer.files[0]);
  });
}

if (innerWidth < 640) $('#width').value = '8';
// Example: the start of a PNG file. Offset 0x10 holds the image width as a big-endian u32.
$('#in').value =
  '89 50 4e 47 0d 0a 1a 0a 00 00 00 0d 49 48 44 52\n00 00 01 00 00 00 00 c0 08 06 00 00 00 5c 72 a8\n66 00 00 00 09 70 48 59 73 00 00 0b 13 00 00 0b\n13 01 00 9a 9c 18 00 00 00 19 74 45 58 74 53 6f\n66 74 77 61 72 65 00 36 6f 32 66 2e 64 65 76 20\n68 65 78 20 74 6f 6f 6c';
$('#q').value = 'IHDR';
setKind();
sel = { a: 16, b: 20 };
anchor = 16;
draw();
