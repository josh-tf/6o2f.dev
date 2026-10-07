import { $, esc, mountBar } from '/_/ui.js';
import { pem, sshFingerprint, sshPublicLine, parseSpki, rsaBits } from './lib.js';
mountBar('Key pairs');

const S = crypto.subtle;
const kty = () => document.querySelector('input[name=kty]:checked').value;
const say = (t) => {
  $('#msg').textContent = t;
};
let out = {},
  spkiDer = null; // out: id -> { text, file, type }
const sshComment = () => $('#comment').value.trim().replace(/\s+/g, ' ');

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
function download(text, file, type) {
  const a = Object.assign(document.createElement('a'), { download: file, href: URL.createObjectURL(new Blob([text], { type })) });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  say(`Downloaded ${file}.`);
}

function sync() {
  const k = kty();
  $('#o-size').hidden = $('#o-use').hidden = k !== 'RSA';
  $('#o-curve').hidden = k !== 'EC';
}

function params() {
  const k = kty();
  if (k === 'RSA') {
    const name = $('#use').value;
    return {
      alg: { name, modulusLength: +$('#size').value, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
      use: name === 'RSA-OAEP' ? ['encrypt', 'decrypt'] : ['sign', 'verify'],
      base: 'id_rsa',
    };
  }
  if (k === 'EC') return { alg: { name: 'ECDSA', namedCurve: $('#curve').value }, use: ['sign', 'verify'], base: 'id_ecdsa' };
  return { alg: { name: 'Ed25519' }, use: ['sign', 'verify'], base: 'id_ed25519' };
}

const BLOCKS = [
  ['ssh', 'OpenSSH public key', 'one line for authorized_keys'],
  ['spki', 'Public key (SPKI PEM)', ''],
  ['pkcs8', 'Private key (PKCS#8 PEM)', 'keep this secret'],
  ['jwkpub', 'Public key (JWK)', ''],
  ['jwk', 'Private key (JWK)', 'keep this secret'],
];
function render() {
  $('#blocks').innerHTML = BLOCKS.map(([id, label, hint]) => {
    const o = out[id],
      rows = id === 'ssh' ? 3 : Math.min(14, o.text.trimEnd().split('\n').length + 1);
    return (
      `<div class="kb"><div class="row"><label for="t-${id}">${esc(label)}${hint ? ` <span class="muted">(${esc(hint)})</span>` : ''}</label>` +
      `<span class="acts"><button type="button" data-copy="${id}" aria-label="Copy ${esc(label)}">Copy</button><button type="button" data-dl="${id}" aria-label="Download ${esc(o.file)}">Download</button></span></div>` +
      `<textarea id="t-${id}" readonly rows="${rows}" spellcheck="false" autocomplete="off">${esc(o.text)}</textarea></div>`
    );
  }).join('');
}

let busy = false;
async function generate() {
  if (busy) return;
  busy = true;
  const p = params(),
    slow = p.alg.modulusLength >= 4096;
  $('#go').disabled = true;
  $('#out').setAttribute('aria-busy', 'true');
  $('#err').textContent = '';
  $('#st').textContent = slow ? 'Generating a 4096-bit RSA key, this can take several seconds…' : 'Generating…';
  const t0 = performance.now();
  try {
    await new Promise((r) => setTimeout(r, 30)); // let the status paint before the CPU-heavy call
    const kp = await S.generateKey(p.alg, true, p.use);
    const [spki, pkcs8, jwk, jwkpub] = await Promise.all([
      S.exportKey('spki', kp.publicKey),
      S.exportKey('pkcs8', kp.privateKey),
      S.exportKey('jwk', kp.privateKey),
      S.exportKey('jwk', kp.publicKey),
    ]);
    const der = (spkiDer = new Uint8Array(spki));
    const info = parseSpki(der);
    const ssh = sshPublicLine(der, sshComment());
    out = {
      ssh: { text: ssh + '\n', file: `${p.base}.pub`, type: 'text/plain' },
      spki: { text: pem(der, 'PUBLIC KEY'), file: 'public.pem', type: 'application/x-pem-file' },
      pkcs8: { text: pem(new Uint8Array(pkcs8), 'PRIVATE KEY'), file: p.base, type: 'application/octet-stream' },
      jwkpub: { text: JSON.stringify(jwkpub, null, 2), file: 'public.jwk.json', type: 'application/json' },
      jwk: { text: JSON.stringify(jwk, null, 2), file: 'private.jwk.json', type: 'application/json' },
    };
    $('#desc').textContent =
      info.type === 'rsa' ? `RSA ${rsaBits(info.n)} bits, ${p.alg.name}, SHA-256` : info.type === 'ec' ? `ECDSA ${p.alg.namedCurve}` : 'Ed25519';
    $('#fp').textContent = await sshFingerprint(der);
    render();
    $('#st').textContent = `Generated in ${((performance.now() - t0) / 1000).toFixed(2)} s.`;
  } catch (e) {
    $('#err').textContent = `Could not generate the key: ${e.message || e}`;
    $('#st').textContent = '';
  } finally {
    busy = false;
    $('#go').disabled = false;
    $('#out').removeAttribute('aria-busy');
  }
}

$('#f').addEventListener('submit', (e) => {
  e.preventDefault();
  generate();
});
// The comment is not part of the key, so editing it updates the OpenSSH line without regenerating.
$('#comment').addEventListener('input', () => {
  if (!spkiDer || !out.ssh) return;
  out.ssh.text = sshPublicLine(spkiDer, sshComment()) + '\n';
  $('#t-ssh').value = out.ssh.text;
});
$('#f').addEventListener('change', (e) => {
  if (e.target.name === 'kty') sync();
});
$('#blocks').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const id = b.dataset.copy || b.dataset.dl,
    o = out[id];
  if (!o) return;
  if (b.dataset.copy) copy(o.text, BLOCKS.find((x) => x[0] === id)[1]);
  else download(o.text, o.file, o.type);
});

// Ed25519 landed in WebCrypto recently; disable the option where it is missing.
try {
  await S.generateKey({ name: 'Ed25519' }, true, ['sign', 'verify']);
} catch {
  $('#ed').disabled = true;
  $('#ednote').hidden = false;
}
sync();
generate();
