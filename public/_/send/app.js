import { $, esc, mountBar } from '/_/ui.js';
import {
  chunkRanges,
  chunkSize,
  cleanOffer,
  fmtBytes,
  ID_RE,
  fmtEta,
  fmtSpeed,
  friendlyName,
  genCode,
  guessDevice,
  parseCode,
  rate,
  rid,
  sanitizeName,
} from './lib.js';
mountBar('Send');

const ICE = { iceServers: [{ urls: 'stun:stun.cloudflare.com:3478' }, { urls: 'stun:stun.l.google.com:19302' }] };
const NO_P2P = 'Could not connect directly. Some networks block peer-to-peer connections.';
const HIGH = 4 << 20,
  LOW = 1 << 20,
  WARN = 1.5 * 2 ** 30,
  MAX_MEM = 4 * 2 ** 30,
  MAX_FILES = 50;
const ICONS = {
  phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  tablet: '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  laptop: '<rect x="4" y="4" width="16" height="11" rx="1"/><path d="M2 20h20l-2-5H4z"/>',
  desktop: '<rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>',
  other: '<circle cx="12" cy="12" r="2"/><path d="M16.2 7.8a6 6 0 0 1 0 8.4M7.8 16.2a6 6 0 0 1 0-8.4"/>',
};
const icon = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[d] ?? ICONS.other}</svg>`;
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
const me = {
  name: sanitizeName(store.get('send.name')) || friendlyName(),
  device: guessDevice(navigator.userAgent, matchMedia('(pointer:coarse)').matches, screen.width),
};
store.set('send.name', me.name);
$('#name').value = me.name;
$('#me-dev').innerHTML = `${icon(me.device)} ${esc(me.device)}`;
$('#me-dev').firstChild.style.cssText = 'width:20px;height:20px;vertical-align:-4px;fill:none;stroke:currentColor;stroke-width:1.8';

let noticeTimer;
const notice = (msg) => {
  $('#notice').textContent = msg;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => ($('#notice').textContent = ''), 6000);
};

// ---- signalling rooms -------------------------------------------------------------------------
const rooms = {}; // 'nearby' | 'code' -> { kind, query, ws, state, peers: Map(id -> {id,name,device}), tries, ping }
const sendMe = (r) => r.ws?.readyState === 1 && r.ws.send(JSON.stringify({ type: 'me', name: me.name, device: me.device }));

function join(kind, query) {
  leave(kind);
  const r = (rooms[kind] = { kind, peers: new Map(), state: 'connecting', tries: 0 });
  const connect = () => {
    if (rooms[kind] !== r) return;
    r.state = r.tries ? 'reconnecting' : 'connecting';
    drawRooms();
    const ws = (r.ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws?${query}`));
    ws.onopen = () => {
      r.tries = 0;
      r.state = 'connected';
      sendMe(r);
      r.ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 25000);
      drawRooms();
    };
    ws.onmessage = (e) => {
      let m;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      } // 'pong'
      if (m.type === 'hello') {
        r.id = m.id;
        r.peers = new Map(m.peers.map((p) => [p.id, p]));
      } else if (m.type === 'join' || m.type === 'update') r.peers.set(m.peer.id, m.peer);
      else if (m.type === 'leave') r.peers.delete(m.id);
      else if (m.type === 'signal') return onSignal(r, m.from, m.data || {});
      drawRooms();
    };
    ws.onclose = () => {
      clearInterval(r.ping);
      if (rooms[kind] !== r) return;
      r.peers.clear();
      r.state = 'reconnecting';
      drawRooms();
      setTimeout(connect, Math.min(15000, 1000 * 2 ** r.tries++) + Math.random() * 500);
    };
  };
  connect();
}
function leave(kind) {
  const r = rooms[kind];
  delete rooms[kind];
  if (r) {
    clearInterval(r.ping);
    r.ws?.close();
  }
  drawRooms();
}

// Keep keyboard focus on the same button when a list is re-rendered (peers and transfers update constantly).
const focusKey = () => {
  const a = document.activeElement,
    li = a?.dataset?.act && a.closest('li[data-xid],li[data-id]');
  return li && [li.dataset.xid ? 'xid' : 'id', li.dataset.xid ?? li.dataset.id, a.dataset.act, li.parentElement.id];
};
const refocus = (k) => k && document.querySelector(`#${k[3]} > li[data-${k[0]}="${CSS.escape(k[1])}"] [data-act="${k[2]}"]`)?.focus();

function drawRooms() {
  for (const kind of ['nearby', 'code']) {
    const r = rooms[kind],
      st = $(`#${kind}-status`);
    if (kind === 'code') {
      $('#pair-idle').hidden = !!r;
      $('#pair-live').hidden = !r;
    }
    if (!r) {
      if (kind === 'nearby') st.textContent = '';
      $(`#${kind}-peers`).innerHTML = '';
      continue;
    }
    const n = r.peers.size;
    st.className = `status ${r.state}`;
    st.textContent =
      r.state !== 'connected'
        ? `${r.state === 'connecting' ? 'Connecting' : 'Reconnecting'}…`
        : n
          ? `Connected. ${n} other device${n > 1 ? 's' : ''} here.`
          : kind === 'nearby'
            ? 'Connected. No other devices yet.'
            : 'Connected. Waiting for another device to enter this code.';
    const fk = focusKey();
    $(`#${kind}-peers`).innerHTML = [...r.peers.values()]
      .map(
        (
          p,
        ) => `<li class="card peer" data-room="${kind}" data-id="${esc(p.id)}">${icon(p.device)}<b>${esc(p.name)}</b><span class="muted">${esc(p.device)}</span>
<div class="row"><button type="button" data-act="files" aria-label="Send files to ${esc(p.name)}">Send files…</button><button type="button" data-act="text" aria-label="Send text to ${esc(p.name)}">Send text…</button></div></li>`,
      )
      .join('');
    refocus(fk);
  }
}

// ---- pick a peer, then send ----------------------------------------------------------------------
let target = null; // { room, id }
const peerOf = (tg) => rooms[tg?.room]?.peers.get(tg.id);
for (const kind of ['nearby', 'code']) {
  const ul = $(`#${kind}-peers`),
    card = (e) => e.target.closest('.peer');
  ul.addEventListener('click', (e) => {
    const b = e.target.closest('button'),
      li = card(e);
    if (!b || !li) return;
    target = { room: kind, id: li.dataset.id };
    if (b.dataset.act === 'files') $('#pick').click();
    else {
      $('#txt-peer').textContent = peerOf(target)?.name ?? '';
      $('#txt-body').value = '';
      $('#txt').showModal();
    }
  });
  ul.addEventListener('dragover', (e) => {
    if (card(e)) {
      e.preventDefault();
      card(e).classList.add('over');
    }
  });
  ul.addEventListener('dragleave', (e) => card(e)?.classList.remove('over'));
  ul.addEventListener('drop', (e) => {
    const li = card(e);
    if (!li) return;
    e.preventDefault();
    li.classList.remove('over');
    const files = [...e.dataTransfer.items].filter((i) => i.kind === 'file' && i.webkitGetAsEntry?.()?.isDirectory !== true).map((i) => i.getAsFile());
    sendFiles({ room: kind, id: li.dataset.id }, files);
  });
}
$('#pick').addEventListener('change', (e) => {
  const f = [...e.target.files];
  e.target.value = '';
  sendFiles(target, f);
});
$('#txt').addEventListener('close', () => {
  const text = $('#txt-body').value;
  if ($('#txt').returnValue === 'send' && text.trim()) sendTo(target, [], text);
});
const sendFiles = (tg, files) => {
  if (!files.length) return;
  if (files.length > MAX_FILES) return notice(`Up to ${MAX_FILES} files at a time.`);
  sendTo(
    tg,
    files.map((file, i) => ({ id: String(i), name: file.name, size: file.size, type: file.type, file })),
    null,
  );
};

// ---- transfers ---------------------------------------------------------------------------------------
const TERMINAL = new Set(['done', 'failed', 'declined', 'cancelled']);
const dead = (t) => TERMINAL.has(t.state);
const xfers = []; // newest first
const conns = new Map(); // transfer id -> t
const canStream = !!window.showSaveFilePicker;

function mk(dir, tg, peer, id = rid()) {
  const t = {
    id,
    dir,
    room: tg.room,
    pid: tg.id,
    peer: peer.name,
    files: [],
    text: null,
    state: 'connecting',
    msg: '',
    bytes: 0,
    total: 0,
    t0: 0,
    acks: {},
    q: Promise.resolve(),
    q2: Promise.resolve(),
  };
  xfers.unshift(t);
  conns.set(id, t);
  return t;
}
const sig = (t, data) => {
  const w = rooms[t.room]?.ws;
  if (w?.readyState === 1) w.send(JSON.stringify({ type: 'signal', to: t.pid, data: { ...data, tid: t.id } }));
};
const dsend = (t, m) => t.dc.send(JSON.stringify(m));

function link(t) {
  const pc = (t.pc = new RTCPeerConnection(ICE));
  pc.onicecandidate = (e) => e.candidate && sig(t, { kind: 'ice', candidate: e.candidate });
  pc.onconnectionstatechange = () => pc.connectionState === 'failed' && finish(t, 'failed', t.opened ? 'Connection lost.' : NO_P2P);
  t.timer = setTimeout(() => finish(t, 'failed', NO_P2P), 20000);
}
function wire(t, dc) {
  t.dc = dc;
  dc.binaryType = 'arraybuffer';
  dc.bufferedAmountLowThreshold = LOW;
  dc.onbufferedamountlow = () => t.wake?.();
  dc.onopen = () => {
    clearTimeout(t.timer);
    t.opened = true;
    if (t.dir === 'out') offer(t);
  };
  dc.onclose = () => finish(t, 'failed', t.opened ? 'Connection lost.' : NO_P2P);
  dc.onmessage = (e) => onData(t, e.data);
  if (dc.readyState === 'open') dc.onopen();
}

/** Ends a transfer exactly once: marks unfinished files, aborts writers, closes the connection shortly after (so a last frame can flush). */
function finish(t, state, msg = '') {
  if (dead(t)) return;
  t.state = state;
  t.msg = msg;
  clearTimeout(t.timer);
  conns.delete(t.id);
  for (const f of t.files) {
    if (f.status === 'sending' || f.status === 'receiving') f.status = 'incomplete';
    else if (f.status === 'queued') f.status = state === 'done' ? 'skipped' : state === 'failed' ? 'incomplete' : state;
    f.w?.abort().catch(() => {});
    f.w = f.chunks = null;
  }
  Object.values(t.acks).forEach((r) => r({}));
  t.wake?.();
  // let the last frame (e.g. cancel) flush behind any queued data before tearing the connection down
  const close = (n = 0) => (t.dc?.readyState === 'open' && t.dc.bufferedAmount && n < 30 ? setTimeout(close, 100, n + 1) : (t.dc?.close(), t.pc?.close()));
  setTimeout(close, state === 'done' ? 1500 : 300);
  draw();
}

// sender
async function sendTo(tg, files, text) {
  const peer = peerOf(tg);
  if (!peer) return notice('That device has left.');
  const t = mk('out', tg, peer);
  t.files = files.map((f) => ({ ...f, done: 0, status: 'queued' }));
  t.text = text;
  t.total = t.files.reduce((s, f) => s + f.size, 0);
  draw();
  try {
    link(t);
    wire(t, t.pc.createDataChannel('f', { ordered: true }));
    await t.pc.setLocalDescription(await t.pc.createOffer());
    sig(t, { kind: 'offer', sdp: t.pc.localDescription });
  } catch {
    finish(t, 'failed', 'Could not start the connection.');
  }
}
function offer(t) {
  t.state = 'waiting';
  draw();
  if (t.text != null) {
    dsend(t, { t: 'text', text: t.text });
    const flushed = () => (dead(t) ? 0 : t.dc.bufferedAmount ? setTimeout(flushed, 100) : finish(t, 'done'));
    return flushed();
  }
  dsend(t, { t: 'offer', files: t.files.map(({ id, name, size, type }) => ({ id, name, size, type })) });
}
async function pump(t) {
  t.state = 'active';
  t.t0 = Date.now();
  draw();
  const size = chunkSize(t.pc.sctp?.maxMessageSize);
  try {
    for (const f of t.files) {
      f.status = 'sending';
      dsend(t, { t: 'file-start', id: f.id });
      draw();
      for (const [a, b] of chunkRanges(f.size, size)) {
        while (t.dc.bufferedAmount > HIGH && !dead(t)) await new Promise((r) => (t.wake = r)); // backpressure
        if (dead(t)) return;
        const buf = await f.file.slice(a, b).arrayBuffer(); // one chunk in memory at a time, however big the file
        t.dc.send(buf);
        f.done += b - a;
        t.bytes += b - a;
      }
      dsend(t, { t: 'file-end', id: f.id });
      const r = await new Promise((res) => (t.acks[f.id] = res));
      if (dead(t)) return;
      f.status = r.ok ? 'complete' : 'incomplete';
      draw();
    }
    t.files.every((f) => f.status === 'complete') ? finish(t, 'done') : finish(t, 'failed', 'Some files are incomplete.');
  } catch {
    finish(t, 'failed', 'Connection lost.');
  }
}

// receiver
function onSignal(r, from, d) {
  let t = conns.get(d.tid);
  if (!t && d.kind === 'offer' && typeof d.tid === 'string' && ID_RE.test(d.tid)) {
    const peer = r.peers.get(from);
    if (!peer) return;
    t = mk('in', { room: r.kind, id: from }, peer, d.tid);
    link(t);
    t.pc.ondatachannel = (e) => wire(t, e.channel);
    draw();
  }
  if (!t || dead(t) || t.room !== r.kind || t.pid !== from) return; // ignore strangers' signals for our transfers
  t.q = t.q
    .then(async () => {
      if (d.kind === 'offer' || d.kind === 'answer') await t.pc.setRemoteDescription(d.sdp);
      if (d.kind === 'offer') {
        await t.pc.setLocalDescription(await t.pc.createAnswer());
        sig(t, { kind: 'answer', sdp: t.pc.localDescription });
      }
      if (d.kind === 'ice' && d.candidate) await t.pc.addIceCandidate(d.candidate);
    })
    .catch(() => {});
}
function onData(t, d) {
  if (dead(t)) return;
  if (typeof d !== 'string') return t.dir === 'in' && task(t, () => chunk(t, d));
  let m;
  try {
    m = JSON.parse(d);
  } catch {
    return;
  }
  if (m.t === 'cancel') return finish(t, 'cancelled', `${t.peer} cancelled.`);
  if (t.dir === 'out') {
    if (m.t === 'accept' && t.state === 'waiting') pump(t);
    else if (m.t === 'decline') finish(t, 'declined', `${t.peer} declined.`);
    else if (m.t === 'file-done') t.acks[m.id]?.(m);
  } else if (m.t === 'offer' && t.state === 'connecting') {
    t.files = cleanOffer(m.files, MAX_FILES).map((f) => ({ ...f, done: 0, status: 'queued' }));
    t.total = t.files.reduce((s, f) => s + f.size, 0);
    if (t.files.length) {
      t.state = 'offered';
      draw();
    } else finish(t, 'failed', 'Empty offer.');
  } else if (m.t === 'text' && t.state === 'connecting') {
    t.text = String(m.text ?? '').slice(0, 20000);
    finish(t, 'done');
  } else if (m.t === 'file-start') task(t, () => start(t, m.id));
  else if (m.t === 'file-end') task(t, () => end(t, m.id));
}
const task = (t, fn) => (t.q2 = t.q2.then(() => !dead(t) && fn()).catch(() => finish(t, 'failed', 'Could not write the file.'))); // chunks must be handled in order
async function start(t, id) {
  const f = t.files.find((x) => x.id === id);
  if (t.state !== 'active' || !f || f.status !== 'queued') return;
  f.status = 'receiving';
  f.got = 0;
  t.cur = f;
  if (f.handle) f.w = await f.handle.createWritable();
  else f.chunks = [];
  draw();
}
async function chunk(t, buf) {
  const f = t.cur;
  if (!f || f.got + buf.byteLength > f.size) return f && (f.over = true);
  if (f.w) await f.w.write(buf);
  else f.chunks.push(buf);
  f.got += buf.byteLength;
  f.done = f.got;
  t.bytes += buf.byteLength;
}
async function end(t, id) {
  const f = t.cur;
  if (!f || f.id !== id) return;
  t.cur = null;
  const ok = f.got === f.size && !f.over; // verify the byte count announced in the offer
  if (f.w) {
    const w = f.w;
    f.w = null;
    await w.close();
  } else if (ok) f.url = URL.createObjectURL(new Blob(f.chunks));
  f.chunks = null;
  f.status = ok ? 'complete' : 'incomplete';
  dsend(t, { t: 'file-done', id: f.id, ok, bytes: f.got });
  if (t.files.every((x) => x.status === 'complete' || x.status === 'incomplete'))
    t.files.every((x) => x.status === 'complete') ? finish(t, 'done') : finish(t, 'failed', 'Some files are incomplete.');
  else draw();
}
/** Called straight from the Accept click so showSaveFilePicker still has the user gesture. */
async function accept(t) {
  if (t.state !== 'offered') return;
  try {
    if (canStream) {
      if (t.files.length === 1) t.files[0].handle = await showSaveFilePicker({ suggestedName: t.files[0].name });
      else {
        const dir = await showDirectoryPicker({ mode: 'readwrite' });
        for (const f of t.files) f.handle = await dir.getFileHandle(f.name, { create: true });
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') notice('Could not open that location.');
    return;
  }
  if (dead(t)) return;
  t.state = 'active';
  t.t0 = Date.now();
  dsend(t, { t: 'accept', ids: t.files.map((f) => f.id) });
  draw();
}

// ---- transfer list --------------------------------------------------------------------------------------------
const LABEL = {
  connecting: 'Connecting…',
  waiting: 'Waiting for the other device to accept…',
  active: '',
  done: 'Complete',
  failed: '',
  declined: '',
  cancelled: '',
};
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
function card(t) {
  const what = t.text != null ? 'text' : `${plural(t.files.length, 'file')}, ${fmtBytes(t.total)}`;
  const title =
    t.dir === 'out'
      ? `To <b>${esc(t.peer)}</b>`
      : t.text != null || t.state !== 'offered'
        ? `From <b>${esc(t.peer)}</b>`
        : `<b>${esc(t.peer)}</b> wants to send ${esc(what)}`;
  const tooBig = !canStream && t.total > MAX_MEM;
  const live = t.state === 'active';
  let body = '';
  if (t.state === 'offered')
    body = tooBig
      ? `<p class="err">This is too large for this browser: without file streaming, files are held in memory and the limit is ${fmtBytes(MAX_MEM)}. Use Chrome or Edge on a computer to receive it.</p><div class="row"><button type="button" data-act="decline" data-t="${esc(t.id)}">Decline</button></div>`
      : `${!canStream && t.total > WARN ? `<p class="err">This is large and will be held in memory until you download it. It may fail on devices with little RAM.</p>` : ''}<p class="muted">${canStream ? 'You will choose where to save.' : 'Files are kept in memory; you download each one when it finishes.'}</p>
<div class="row"><button type="button" class="primary" data-act="accept" data-t="${esc(t.id)}">Accept</button><button type="button" data-act="decline" data-t="${esc(t.id)}">Decline</button></div>`;
  else if (live)
    body = `<progress aria-label="Progress" data-p="${esc(t.id)}" max="${t.total || 1}" value="0"></progress><div class="muted" data-st="${esc(t.id)}"></div>`;
  const status = t.msg || LABEL[t.state];
  const files = t.files.length
    ? `<ul class="files">${t.files
        .map(
          (f) => `<li><span class="n">${esc(f.name)}</span><span class="muted">${fmtBytes(f.size)}</span>
${f.status === 'sending' || f.status === 'receiving' ? `<progress aria-label="Progress of ${esc(f.name)}" data-f="${esc(t.id)}/${esc(f.id)}" max="${f.size || 1}" value="0"></progress>` : `<span class="${f.status === 'incomplete' ? 'err' : 'muted'}">${esc(f.status)}</span>`}
${f.url ? `<a href="${esc(f.url)}" download="${esc(f.name)}">Download</a>` : ''}</li>`,
        )
        .join('')}</ul>`
    : '';
  const text =
    t.dir === 'in' && t.text != null
      ? `<pre id="tx-${esc(t.id)}"></pre><div class="row"><button type="button" data-act="copy" data-t="${esc(t.id)}">Copy</button></div>`
      : '';
  return `<li class="card" data-xid="${esc(t.id)}"><div class="head">${title}<span class="tag">${esc(t.dir === 'out' ? 'sent' : 'received')} · ${esc(t.state === 'offered' ? 'request' : t.state)}</span></div>
${status ? `<p class="${t.state === 'failed' ? 'err' : 'muted'}" style="margin:6px 0 0">${esc(status)}</p>` : ''}${body}${text}${files}
${!dead(t) && t.state !== 'offered' ? `<div class="row"><button type="button" class="danger" data-act="cancel" data-t="${esc(t.id)}">Cancel</button></div>` : ''}</li>`;
}
function draw() {
  const fk = focusKey();
  $('#xfers').innerHTML = xfers.map(card).join('');
  refocus(fk);
  $('#xempty').hidden = xfers.length > 0;
  for (const t of xfers) if (t.dir === 'in' && t.text != null) $(`#tx-${t.id}`).textContent = t.text; // text only, never HTML
  tick();
}
function tick() {
  for (const t of xfers) {
    if (t.state !== 'active') continue;
    const { speed, eta } = rate(t.bytes, t.total, Date.now() - t.t0);
    const cur = t.files.find((f) => f.status === 'sending' || f.status === 'receiving');
    const p = $(`[data-p="${t.id}"]`);
    if (p) p.value = t.bytes;
    const s = $(`[data-st="${t.id}"]`);
    if (s)
      s.textContent = `${t.dir === 'out' ? 'Sending' : 'Receiving'} ${cur ? cur.name : ''} · ${fmtBytes(t.bytes)} of ${fmtBytes(t.total)} · ${fmtSpeed(speed)} · ${fmtEta(eta)} left`;
    for (const f of t.files) {
      const fp = $(`[data-f="${t.id}/${f.id}"]`);
      if (fp) fp.value = f.done;
    }
  }
}
setInterval(tick, 250);
$('#xfers').addEventListener('click', async (e) => {
  const b = e.target.closest('button'),
    t = xfers.find((x) => x.id === b?.dataset.t);
  if (!t) return;
  const a = b.dataset.act;
  if (a === 'accept') accept(t);
  else if (a === 'decline') {
    try {
      dsend(t, { t: 'decline' });
    } catch {}
    finish(t, 'declined', 'You declined.');
  } else if (a === 'cancel') {
    try {
      dsend(t, { t: 'cancel' });
    } catch {}
    finish(t, 'cancelled', 'You cancelled.');
  } else if (a === 'copy') {
    try {
      await navigator.clipboard.writeText(t.text);
      b.textContent = 'Copied';
    } catch {
      b.textContent = 'Copy failed';
    }
    setTimeout(() => (b.textContent = 'Copy'), 1500);
  }
});
$('#clear').addEventListener('click', () => {
  for (let i = xfers.length; i--;)
    if (dead(xfers[i])) {
      xfers[i].files.forEach((f) => f.url && URL.revokeObjectURL(f.url));
      xfers.splice(i, 1);
    }
  draw();
});

// ---- identity, pairing -------------------------------------------------------------------------------------------
$('#name').addEventListener('change', (e) => {
  me.name = sanitizeName(e.target.value) || friendlyName();
  e.target.value = me.name;
  store.set('send.name', me.name);
  Object.values(rooms).forEach(sendMe);
});
function joinCode(code) {
  $('#join-code').value = '';
  $('#code').textContent = code;
  $('#share').value = `${location.origin}/#${code}`;
  history.replaceState(null, '', `#${code}`);
  join('code', `code=${code}`);
}
$('#host').addEventListener('click', () => joinCode(genCode()));
const doJoin = () => {
  const c = parseCode($('#join-code').value);
  c ? joinCode(c) : notice('Codes are 6 characters, letters and digits (no I, O, 0 or 1).');
};
$('#join').addEventListener('click', doJoin);
$('#join-code').addEventListener('keydown', (e) => e.key === 'Enter' && doJoin());
$('#leave').addEventListener('click', () => {
  history.replaceState(null, '', location.pathname);
  $('#code').textContent = '';
  leave('code');
});
const copy = async (b, text) => {
  try {
    await navigator.clipboard.writeText(text);
    b.textContent = 'Copied';
  } catch {
    b.textContent = 'Copy failed';
  }
  setTimeout(() => (b.textContent = b.dataset.l), 1500);
};
for (const b of [$('#copy-code'), $('#copy-link')]) {
  b.dataset.l = b.textContent;
  b.addEventListener('click', () => copy(b, b.id === 'copy-code' ? $('#code').textContent : $('#share').value));
}
const hashJoin = () => {
  const c = parseCode(location.hash);
  c && c !== $('#code').textContent && joinCode(c);
};
addEventListener('hashchange', hashJoin);
addEventListener('pagehide', () => xfers.forEach((t) => t.files.forEach((f) => f.url && URL.revokeObjectURL(f.url))));

join('nearby', 'mode=nearby');
hashJoin();
draw();
