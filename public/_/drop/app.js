import { $, api, esc, mountBar } from '/_/ui.js';
mountBar('Drop');
const MAX = 100 * 1048576;
const size = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`);
async function copyText(text, btn, label) {
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = 'Copied';
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(t);
    t.select();
    const ok = document.execCommand?.('copy');
    t.remove();
    btn.textContent = ok ? 'Copied' : 'Press Ctrl+C';
  }
  setTimeout(() => (btn.textContent = label), 1500);
}
async function load() {
  try {
    $('#list').innerHTML =
      (await api('/api/files'))
        .map(
          (
            f,
          ) => `<tr><td class="n"><a href="${esc(f.url)}" rel="noopener noreferrer">${esc(f.name)}</a></td><td>${size(f.size)}</td><td><time datetime="${new Date(f.expires_at).toISOString()}">${esc(new Date(f.expires_at).toLocaleString())}</time></td><td>${f.downloads}</td>
    <td class="act"><button type="button" data-copy="${esc(f.url)}" aria-label="Copy link to ${esc(f.name)}">Copy link</button> <button type="button" class="danger" data-del="${esc(f.id)}" aria-label="Delete ${esc(f.name)}">Delete</button></td></tr>`,
        )
        .join('') || '<tr><td class="muted" colspan="5">No files yet. Drop one above.</td></tr>';
  } catch (x) {
    $('#msg').textContent = `Could not load your files: ${x.message}`;
  }
}
const armed = new Map();
$('#list').addEventListener('click', async (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.copy) return copyText(b.dataset.copy, b, 'Copy link');
  const id = b.dataset.del;
  if (!id) return;
  if (!armed.has(id)) {
    b.textContent = 'Confirm?';
    armed.set(
      id,
      setTimeout(() => {
        armed.delete(id);
        b.textContent = 'Delete';
      }, 3000),
    );
    return;
  }
  clearTimeout(armed.get(id));
  armed.delete(id);
  try {
    await api(`/api/files/${id}`, { method: 'DELETE' });
  } catch (x) {
    $('#msg').textContent = x.message;
  }
  load();
});
/** Resolves with null on success or an error message. */
function send(file) {
  return new Promise((done) => {
    const prog = $('#prog');
    const x = new XMLHttpRequest();
    x.open('PUT', `/api/files?name=${encodeURIComponent(file.name)}&ttl=${$('#ttl').value}`);
    x.upload.onprogress = (e) => {
      if (e.lengthComputable) prog.value = (e.loaded / e.total) * 100;
    };
    x.onload = () => {
      if (x.status === 401) return location.reload();
      if (x.status === 201) return done(null);
      let m = `Failed (${x.status})`;
      try {
        m = JSON.parse(x.responseText).error || m;
      } catch {}
      done(`${file.name}: ${m}`);
    };
    x.onerror = () => done(`${file.name}: upload failed, check your connection.`);
    x.send(file);
  });
}
let busy = false;
async function upload(files) {
  files = [...files];
  if (!files.length || busy) return;
  const msg = $('#msg'),
    st = $('#status'),
    prog = $('#prog'),
    errs = [];
  msg.textContent = '';
  busy = true;
  $('#go').disabled = true;
  for (const [i, f] of files.entries()) {
    if (f.size > MAX) {
      errs.push(`${f.name}: over 100 MB (${size(f.size)}).`);
      continue;
    }
    if (!f.size) {
      errs.push(`${f.name}: the file is empty.`);
      continue;
    }
    st.textContent = `Uploading ${f.name} (${i + 1} of ${files.length})…`;
    prog.value = 0;
    prog.hidden = false;
    const e = await send(f);
    if (e) errs.push(e);
  }
  prog.hidden = true;
  busy = false;
  $('#file').value = '';
  $('#go').disabled = true;
  const ok = files.length - errs.length;
  st.textContent = ok ? `Uploaded ${ok} file${ok > 1 ? 's' : ''}.` : '';
  msg.textContent = errs.join(' ');
  load();
}
$('#file').addEventListener('change', () => ($('#go').disabled = !$('#file').files.length));
$('#zone').addEventListener('submit', (e) => {
  e.preventDefault();
  upload($('#file').files);
});
const z = $('#zone');
z.addEventListener('dragover', (e) => {
  e.preventDefault();
  z.classList.add('over');
});
z.addEventListener('dragleave', (e) => {
  if (!z.contains(e.relatedTarget)) z.classList.remove('over');
});
z.addEventListener('drop', (e) => {
  e.preventDefault();
  z.classList.remove('over');
  upload(e.dataTransfer.files);
});
load();
