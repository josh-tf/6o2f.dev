import { $, esc, mountBar } from '/_/ui.js';
import { info, fmt, binary, split, aggregate, contains, convert, range, count, expand6 } from './lib.js';
mountBar('CIDR');
const LIST = 256;
let cur = null;

function drawBlock() {
  const i = info($('#cidr').value);
  $('#cerr').textContent = i.error ?? '';
  $('#cidr').setAttribute('aria-invalid', String(!!i.error));
  if (i.error) {
    // don't leave the previous block's results on screen next to the error
    cur = null;
    for (const id of ['#irows', '#bin', '#flags', '#subs']) $(id).innerHTML = '';
    $('#hostnote').hidden = true;
    $('#ssum').textContent = '';
    $('#inres').textContent = '';
    return;
  }
  cur = i;
  const v = i.v,
    f = (n) => fmt(n, v);
  $('#hostnote').hidden = !i.hostBits;
  $('#hostnote').innerHTML = i.hostBits ? `${esc(f(i.addr))} has host bits set; the block it belongs to is <code>${esc(i.cidr)}</code>.` : '';
  const rows = [
    ['Network', i.cidr],
    ['IP version', `IPv${v}`],
    ...(v === 6 ? [['Expanded', expand6(i.net)]] : []),
    ['Netmask', i.netmask],
    ['Wildcard', i.wildcard],
    ...(i.broadcast ? [['Broadcast', i.broadcast]] : []),
    ['First usable', f(i.first)],
    ['Last usable', f(i.lastHost)],
    ['Addresses', count(i.size)],
    [
      'Usable hosts',
      `${count(i.usable)}${v === 4 && i.prefix === 31 ? ' (point-to-point, RFC 3021)' : v === 4 && i.prefix === 32 ? ' (single host)' : v === 6 && i.prefix < 128 ? ' (no broadcast in IPv6)' : ''}`,
    ],
    ...(v === 4 ? [['Class', i.flags.class]] : []),
    ['Reverse DNS', i.ptr],
  ];
  $('#irows').innerHTML = rows.map(([k, val]) => `<tr><th scope="row">${esc(k)}</th><td><code>${esc(val)}</code></td></tr>`).join('');
  // Binary: network bits in accent, host bits muted.
  const mark = (n) => {
    let bit = 0;
    return [...binary(n, v)].map((ch) => (ch === '.' || ch === ':' ? ch : bit++ < i.prefix ? `<b>${ch}</b>` : `<i>${ch}</i>`)).join('');
  };
  $('#bin').innerHTML =
    `<span class="lb">Address</span>${mark(i.addr)}\n<span class="lb">Mask</span>${mark(i.mask)}\n<span class="lb">Network</span>${mark(i.net)}`;
  const fl = i.flags.labels.length
    ? i.flags.labels.map((l) => `<li class="${l.kind}"><b>${esc(l.label)}</b> <span class="muted">${esc(l.block)}</span></li>`)
    : [];
  if (i.flags.public && !fl.length) fl.push('<li class="global"><b>Public</b> <span class="muted">globally routable</span></li>');
  $('#flags').innerHTML = fl.join('');
  $('#np').max = v === 4 ? 32 : 128;
  $('#np').min = i.prefix;
  if (+$('#np').value < i.prefix || +$('#np').value > +$('#np').max) $('#np').value = Math.min(i.prefix + (v === 4 ? 2 : 16), +$('#np').max);
  drawSplit();
  drawIn();
}
function drawSplit() {
  if (!cur) return;
  const s = split(cur.cidr, $('#np').value, LIST);
  $('#serr').textContent = s.error ?? '';
  if (s.error) {
    $('#subs').innerHTML = '';
    $('#ssum').textContent = '';
    return;
  }
  const np = +$('#np').value,
    each = 1n << BigInt((cur.v === 4 ? 32 : 128) - np);
  $('#ssum').textContent =
    `${count(s.count)} subnet${s.count === 1n ? '' : 's'} of /${np}, ${count(each)} address${each === 1n ? '' : 'es'} each${s.count > BigInt(LIST) ? ` (first ${LIST} shown)` : ''}.`;
  $('#subs').innerHTML = s.subnets.map((x) => `<li><code>${esc(x)}</code></li>`).join('');
}
function drawIn() {
  if (!cur) return;
  const r = contains(cur.cidr, $('#probe').value),
    o = $('#inres');
  if (!$('#probe').value.trim()) {
    o.textContent = '';
    return;
  }
  o.className = `big ${r.error ? 'no' : r.inside ? 'yes' : 'no'}`;
  o.textContent = r.error ? r.error : r.inside ? `Yes, inside ${cur.cidr}` : `No, outside ${cur.cidr}${r.reason ? ` (${r.reason})` : ''}`;
}
function drawConv() {
  const r = convert($('#conv').value);
  $('#cverr').textContent = r.error ?? '';
  $('#cvrows').innerHTML = r.error
    ? ''
    : [['Address', r.ip], ...(r.full ? [['Expanded', r.full]] : []), ['Decimal', r.dec], ['Hex', r.hex]]
        .map(([k, val]) => `<tr><th scope="row">${k}</th><td><code>${esc(val)}</code></td></tr>`)
        .join('');
}
function drawAgg() {
  const r = aggregate($('#agg').value);
  $('#aerr').textContent = r.errors.length ? `Skipped ${r.errors.length}: ${r.errors.slice(0, 3).join('; ')}${r.errors.length > 3 ? '…' : ''}` : '';
  $('#asum').textContent = r.before
    ? `${r.before} entr${r.before === 1 ? 'y' : 'ies'} merged into ${r.cidrs.length} block${r.cidrs.length === 1 ? '' : 's'}.`
    : 'Paste some blocks to merge.';
  $('#aout').textContent = r.cidrs.join('\n');
  $('#aout').hidden = !r.cidrs.length;
}
function drawRange() {
  const a = $('#rs').value,
    b = $('#re').value;
  const r = range(a, b);
  $('#rerr').textContent = r.error ?? '';
  $('#rsum').textContent = r.error ? '' : `${count(r.size)} address${r.size === 1n ? '' : 'es'} in ${r.cidrs.length} block${r.cidrs.length === 1 ? '' : 's'}.`;
  $('#rout').textContent = r.error ? '' : r.cidrs.join('\n');
  $('#rout').hidden = !!r.error;
}

let msgT;
async function copy(text, what) {
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(t);
    t.select();
    try {
      ok = document.execCommand('copy');
    } catch {}
    t.remove();
  }
  $('#msg').textContent = ok ? `Copied ${what}` : 'Copy blocked by the browser. Select the text and press Ctrl+C.';
  clearTimeout(msgT);
  msgT = setTimeout(() => ($('#msg').textContent = ''), 2500);
}
$('#cidr').addEventListener('input', () => {
  drawBlock();
  history.replaceState(null, '', `#${encodeURIComponent($('#cidr').value.trim())}`);
});
$('#np').addEventListener('input', drawSplit);
$('#probe').addEventListener('input', drawIn);
$('#conv').addEventListener('input', drawConv);
$('#agg').addEventListener('input', drawAgg);
$('#rs').addEventListener('input', drawRange);
$('#re').addEventListener('input', drawRange);
$('#cpcidr').addEventListener('click', () => cur && copy(cur.cidr, cur.cidr));
$('#cpsubs').addEventListener('click', () => {
  if (!cur) return;
  const s = split(cur.cidr, $('#np').value, 65536);
  if (!s.error) copy(s.subnets.join('\n'), `${s.subnets.length} subnets`);
});
$('#cpagg').addEventListener('click', () => copy($('#aout').textContent, 'merged list'));
$('#cprange').addEventListener('click', () => copy($('#rout').textContent, 'CIDR list'));

let h = '';
try {
  h = decodeURIComponent(location.hash.slice(1));
} catch {}
if (h) $('#cidr').value = h;
drawBlock();
drawConv();
drawAgg();
drawRange();
