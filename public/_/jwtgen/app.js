import { $, esc, mountBar } from '/_/ui.js';
import { ALGS, importKeys, parseObject, randomId, rel, secretBytes, signJwt, timeStatus, verifyJwt } from './lib.js';
import { pem } from '../keygen/lib.js';
mountBar('JWT signer');

const now = () => Math.floor(Date.now() / 1000);
const say = (t) => {
  $('#msg').textContent = t;
};
const pemByAlg = { RS256: '', ES256: '' };
let token = '',
  seq = 0,
  keyCache = { id: '', keys: null };

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
const pretty = (o) => JSON.stringify(o, null, 2);
function readJson(id, what, errId) {
  try {
    const v = parseObject($(id).value, what);
    $(errId).textContent = '';
    $(id).removeAttribute('aria-invalid');
    return v;
  } catch (e) {
    $(errId).textContent = e.message;
    $(id).setAttribute('aria-invalid', 'true');
    return null;
  }
}
/** Rewrite the payload editor through `fn`, if it parses. */
function editPayload(fn) {
  const p = readJson('#payload', 'Payload', '#perr');
  if (!p) {
    say('Fix the payload JSON first.');
    return;
  }
  fn(p);
  $('#payload').value = pretty(p);
  update();
}
function fillClaimInputs(p) {
  for (const k of ['iss', 'sub']) if (document.activeElement !== $(`#${k}`)) $(`#${k}`).value = typeof p[k] === 'string' ? p[k] : '';
  if (document.activeElement !== $('#aud')) $('#aud').value = Array.isArray(p.aud) ? p.aud.join(', ') : typeof p.aud === 'string' ? p.aud : '';
}

async function getKeys(alg) {
  const a = ALGS[alg];
  let material, id;
  if (a.kind === 'hmac') {
    material = secretBytes($('#secret').value, $('#b64').checked);
    const short = material.length < a.bytes;
    $('#secret-help').textContent =
      `${material.length} bytes.${short ? ` ${alg} wants at least ${a.bytes} bytes; a short secret is easier to brute-force.` : ''}`;
    $('#secret-help').className = short ? 'err small' : 'muted small';
    id = `${alg}|${$('#b64').checked}|${$('#secret').value}`;
  } else {
    material = $('#pem').value;
    id = `${alg}|${material}`;
  }
  if (keyCache.id !== id) keyCache = { id, keys: await importKeys(alg, material) };
  return keyCache.keys;
}

async function update() {
  const my = ++seq,
    alg = $('#alg').value;
  const h = readJson('#header', 'Header', '#herr'),
    p = readJson('#payload', 'Payload', '#perr');
  if (p) {
    fillClaimInputs(p);
    const t = now();
    $('#times').innerHTML = ['iat', 'nbf', 'exp']
      .filter((k) => Number.isFinite(p[k]) && Math.abs(p[k]) <= 8.64e12)
      .map((k) => {
        const d = new Date(p[k] * 1000);
        return `<li>${k}: <time datetime="${d.toISOString()}">${esc(d.toISOString().replace('T', ' ').slice(0, 19))} UTC</time> (${esc(rel(p[k] - t))})</li>`;
      })
      .join('');
  }
  if (h && h.alg !== alg) {
    $('#herr').textContent = ALGS[h.alg] ? '' : `Header alg "${h.alg ?? ''}" is not one of HS256, HS384, HS512, RS256, ES256.`;
    if (ALGS[h.alg]) {
      $('#alg').value = h.alg;
      $('#alg').dispatchEvent(new Event('change'));
      return;
    }
  }
  const fail = (m) => {
    token = '';
    $('#token').textContent = '';
    $('#copy').disabled = true;
    $('#verify').textContent = '';
    $('#verify').className = 'vline';
    $('#err').textContent = m;
  };
  if (!h || !p || h.alg !== alg) return fail(h && p ? '' : 'Fix the JSON above to get a token.');
  try {
    const keys = await getKeys(alg);
    const t = await signJwt(alg, h, p, keys);
    const ok = await verifyJwt(t, alg, keys);
    if (my !== seq) return;
    token = t;
    $('#err').textContent = '';
    $('#copy').disabled = false;
    const [a, b, c] = t.split('.');
    $('#token').innerHTML = `<span class="h">${a}</span>.<span class="p">${b}</span>.<span class="s">${c}</span>`;
    const ts = timeStatus(p, now());
    const time =
      ts.state === 'expired'
        ? 'but it has already expired (exp is in the past)'
        : ts.state === 'notyet'
          ? 'but it is not valid yet (nbf is in the future)'
          : 'and its time claims are valid now';
    $('#verify').textContent = ok
      ? `Verified: the signature checks out with ${ALGS[alg].kind === 'hmac' ? 'the same secret' : 'the matching public key'}, ${time}.${ts.bad.length ? ' ' + ts.bad.join(' ') : ''}`
      : 'Verification failed: the signature did not check out.';
    $('#verify').className = `vline ${ok && ts.state === 'valid' && !ts.bad.length ? 'ok' : 'bad'}`;
    if (keys.publicPem) {
      $('#pub').value = keys.publicPem;
      $('#pubbox').hidden = false;
    } else $('#pubbox').hidden = true;
  } catch (e) {
    if (my === seq) fail(e.message);
  }
}

function syncKeyUi() {
  const hm = ALGS[$('#alg').value].kind === 'hmac';
  $('#k-hmac').hidden = !hm;
  $('#k-pem').hidden = hm;
}
async function genKey() {
  const alg = $('#alg').value,
    a = ALGS[alg];
  $('#gen').disabled = true;
  $('#genst').textContent = 'Generating…';
  try {
    const kp = await crypto.subtle.generateKey(
      a.kind === 'rsa'
        ? { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }
        : { name: 'ECDSA', namedCurve: 'P-256' },
      true,
      ['sign', 'verify'],
    );
    $('#pem').value = pemByAlg[alg] = pem(new Uint8Array(await crypto.subtle.exportKey('pkcs8', kp.privateKey)), 'PRIVATE KEY');
    $('#genst').textContent = `New ${a.kind === 'rsa' ? 'RSA 2048' : 'P-256'} key, kept only in this tab.`;
  } finally {
    $('#gen').disabled = false;
  }
  update();
}

$('#alg').addEventListener('change', async () => {
  const alg = $('#alg').value;
  syncKeyUi();
  try {
    const h = parseObject($('#header').value, 'Header');
    h.alg = alg;
    $('#header').value = pretty(h);
  } catch {}
  if (ALGS[alg].kind !== 'hmac') {
    $('#pem').value = pemByAlg[alg];
    if (!pemByAlg[alg]) return genKey();
  }
  update();
});
$('#pem').addEventListener('input', () => {
  pemByAlg[$('#alg').value] = $('#pem').value;
});
$('#gen').addEventListener('click', genKey);
for (const id of ['iss', 'sub', 'aud'])
  $(`#${id}`).addEventListener('input', () =>
    editPayload((p) => {
      const v = $(`#${id}`).value.trim();
      if (!v) delete p[id];
      else if (id === 'aud') {
        const l = v
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        p.aud = l.length > 1 ? l : l[0];
      } else p[id] = v;
    }),
  );
document.querySelector('.btns').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  editPayload((p) => {
    if (b.dataset.exp) p.exp = now() + +b.dataset.exp;
    else if (b.dataset.set === 'jti') p.jti = randomId();
    else if (b.dataset.set) p[b.dataset.set] = now();
    else for (const k of b.dataset.del.split(' ')) delete p[k];
  });
  say(`Updated the payload (${b.textContent}).`);
});
for (const id of ['#header', '#payload', '#secret', '#pem']) $(id).addEventListener('input', update);
$('#b64').addEventListener('change', update);
$('#copy').addEventListener('click', () => token && copy(token, 'token'));
$('#pubbox').addEventListener('click', (e) => {
  if (e.target.dataset.copy) copy($('#pub').value, 'public key');
});

// Example: an access token for an API, issued now, valid for an hour.
const t = now();
$('#secret').value = 'a-string-secret-at-least-256-bits-long';
$('#header').value = pretty({ alg: 'HS256', typ: 'JWT' });
$('#payload').value = pretty({
  iss: 'https://auth.example.com',
  sub: 'user_42',
  aud: 'api.example.com',
  name: 'Ada Lovelace',
  scope: 'read:orders write:orders',
  iat: t,
  exp: t + 3600,
  jti: randomId(),
});
syncKeyUi();
update();
