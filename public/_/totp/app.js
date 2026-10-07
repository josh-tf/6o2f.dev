import { $, mountBar } from '/_/ui.js';
import { b32decode, buildOtpauth, group, hotp, parseOtpauth, randomSecret, secondsLeft } from './lib.js';
import qrcode from '../qr/vendor/qrcode.mjs';
mountBar('TOTP');

const KEY = 'totp-secret';
const store = {
  get() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch {
      return null;
    }
  },
  set(v) {
    try {
      localStorage.setItem(KEY, JSON.stringify(v));
    } catch {}
  },
  del() {
    try {
      localStorage.removeItem(KEY);
    } catch {}
  },
};
const C = 2 * Math.PI * 19;
const type = () => document.querySelector('input[name=type]:checked').value;
const cfg = () => ({
  type: type(),
  secret: $('#secret').value,
  label: $('#label').value.trim(),
  issuer: $('#issuer').value.trim(),
  algorithm: $('#alg').value,
  digits: +$('#digits').value,
  period: Math.max(1, Math.floor(+$('#period').value) || 30),
  counter: Math.max(0, Math.floor(+$('#counter').value) || 0),
});
const say = (t) => {
  $('#msg').textContent = t;
};

async function copy(text, what) {
  try {
    await navigator.clipboard.writeText(text);
    say(`Copied ${what}.`);
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    say(ok ? `Copied ${what}.` : 'Copy blocked by the browser. Select the text and press Ctrl+C.');
  }
}

let lastKey = '',
  code = '',
  gen = 0;
async function compute(force) {
  const my = ++gen,
    c = cfg(),
    isT = c.type === 'totp',
    now = Date.now() / 1000;
  $('#f-period').hidden = !isT;
  $('#f-counter').hidden = isT;
  $('#inc').hidden = isT;
  $('#ringwrap').hidden = !isT;
  let key;
  try {
    key = b32decode(c.secret);
  } catch (e) {
    $('#err').textContent = c.secret.trim() ? e.message : 'Enter a base32 secret to see a code.';
    $('#code').textContent = '------';
    $('#next').textContent = '------';
    $('#uri').value = '';
    $('#copy').disabled = $('#copyuri').disabled = true;
    lastKey = '';
    code = '';
    $('#qr').hidden = true;
    $('#meta').textContent = '';
    return;
  }
  $('#err').textContent = '';
  $('#copy').disabled = $('#copyuri').disabled = false;
  $('#qr').hidden = false;
  const step = isT ? Math.floor(now / c.period) : c.counter;
  const k = [c.type, c.secret, c.algorithm, c.digits, c.period, step, c.label, c.issuer].join('|');
  if (k !== lastKey || force) {
    lastKey = k;
    const o = { digits: c.digits, algorithm: c.algorithm };
    const [cur, nxt] = await Promise.all([hotp(key, step, o), hotp(key, step + 1, o)]);
    if (my !== gen) return; // a newer call superseded this one while HMAC ran
    code = cur;
    $('#code').textContent = group(code);
    $('#next').textContent = group(nxt);
    $('#meta').textContent =
      key.length < 10
        ? `Weak secret: ${key.length * 8} bits (16 bytes or more is recommended).`
        : `${c.algorithm}, ${c.digits} digits, ${isT ? `${c.period} s period` : `counter ${step}`}`;
    const uri = buildOtpauth({ ...c, secret: c.secret });
    $('#uri').value = uri;
    drawQr(uri);
    persist(c);
  }
}
function drawQr(text) {
  try {
    const q = qrcode(0, 'M');
    q.addData(text);
    q.make();
    const n = q.getModuleCount(),
      s = 6,
      quiet = 4,
      cv = $('#qr'),
      t = (n + 2 * quiet) * s;
    cv.width = cv.height = t;
    const x = cv.getContext('2d');
    x.fillStyle = '#fff';
    x.fillRect(0, 0, t, t);
    x.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) x.fillRect((c + quiet) * s, (r + quiet) * s, s, s);
  } catch {
    $('#qr').hidden = true;
  }
}
function persist(c) {
  if ($('#remember').checked)
    store.set({
      secret: c.secret,
      label: c.label,
      issuer: c.issuer,
      type: c.type,
      algorithm: c.algorithm,
      digits: c.digits,
      period: c.period,
      counter: c.counter,
    });
}

function tick() {
  const c = cfg();
  if (c.type === 'totp') {
    const now = Date.now() / 1000,
      left = secondsLeft(now, c.period),
      frac = (c.period - (now % c.period)) / c.period;
    $('#secs').textContent = left;
    $('#ring').style.strokeDashoffset = (1 - frac) * C;
    $('#ringwrap').classList.toggle('low', left <= 5);
  }
  compute();
}

function apply(p) {
  $('#secret').value = p.secret ?? $('#secret').value;
  $('#label').value = p.label ?? '';
  $('#issuer').value = p.issuer ?? '';
  document.querySelector(`input[name=type][value=${p.type || 'totp'}]`).checked = true;
  $('#alg').value = p.algorithm || 'SHA-1';
  $('#digits').value = String(p.digits || 6);
  $('#period').value = p.period || 30;
  $('#counter').value = p.counter || 0;
}

$('#rand').addEventListener('click', () => {
  $('#secret').value = randomSecret(20);
  $('#label').value ||= 'me';
  compute();
  say('Generated a new random 160-bit secret.');
});
$('#copy').addEventListener('click', () => copy(code, 'code'));
$('#copyuri').addEventListener('click', () => copy($('#uri').value, 'URI'));
$('#inc').addEventListener('click', async () => {
  await copy(code, 'code');
  $('#counter').value = cfg().counter + 1;
  compute();
  say(`Copied the code and advanced the counter to ${$('#counter').value}.`);
});
$('#load').addEventListener('click', () => {
  try {
    apply(parseOtpauth($('#import').value));
    $('#import-err').textContent = '';
    $('#import').value = '';
    compute(true);
    say('Loaded the URI.');
  } catch (e) {
    $('#import-err').textContent = e.message;
  }
});
$('#import').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('#load').click();
});
$('#remember').addEventListener('change', () => {
  if ($('#remember').checked) {
    persist(cfg());
    say('Saved in this browser (unencrypted).');
  } else {
    store.del();
    say('Removed the saved secret from this browser.');
  }
});
document.addEventListener('input', (e) => {
  if (e.target.closest('main') && e.target.id !== 'import') compute();
});
document.addEventListener('change', () => compute());

const saved = store.get();
if (saved?.secret) {
  apply(saved);
  $('#remember').checked = true;
}
await compute(true);
tick();
setInterval(tick, 250);
