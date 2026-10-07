import { $, mountBar } from '/_/ui.js';
import { drawIcon, ico, iconText, linkTags, SIZES, svgIcon } from './lib.js';
import { colorFieldHtml, wireColorFields } from '/_/gradient/colorfield.js';
$('#c-bg').innerHTML = colorFieldHtml('bg', '#4f46e5', 'background color');
$('#c-bg2').innerHTML = colorFieldHtml('bg2', '#06b6d4', 'gradient end color');
$('#c-fg').innerHTML = colorFieldHtml('fg', '#ffffff', 'text color');
const col = { bg: '#4f46e5', bg2: '#06b6d4', fg: '#ffffff' };
wireColorFields(document, (input, hex) => {
  col[input.id] = hex;
  render();
});
const bytes = (url) => Uint8Array.from(atob(url.split(',')[1]), (c) => c.charCodeAt(0));
mountBar('Icon');
const opts = () => ({
  text: iconText($('#text').value),
  shape: $('#shape').value,
  bg: col.bg,
  bg2: $('#grad').checked ? col.bg2 : '',
  fg: col.fg,
  weight: $('#weight').value,
});
const canvas = (o, s) => {
  const c = document.createElement('canvas');
  c.width = c.height = s;
  drawIcon(c.getContext('2d'), o, s);
  return c;
};
function render() {
  for (const a of document.querySelectorAll('#dl a[href^="blob:"]')) URL.revokeObjectURL(a.href);
  const o = opts();
  for (const el of $('#c-bg2').querySelectorAll('input,button')) el.disabled = !$('#grad').checked;
  $('#prev').replaceChildren(
    ...SIZES.map((s) => {
      const f = document.createElement('figure'),
        c = canvas(o, s);
      if (s > 180) c.style.width = '180px';
      f.append(c, Object.assign(document.createElement('figcaption'), { textContent: `${s}px` }));
      return f;
    }),
  );
  $('#dl').replaceChildren(
    ...SIZES.map((s) =>
      Object.assign(document.createElement('a'), {
        className: 'btn',
        textContent: `PNG ${s}`,
        download: s === 180 ? 'apple-touch-icon.png' : `favicon-${s}.png`,
        href: canvas(o, s).toDataURL('image/png'),
      }),
    ),
    Object.assign(document.createElement('a'), {
      className: 'btn primary',
      textContent: 'ICO',
      download: 'favicon.ico',
      href: URL.createObjectURL(
        new Blob([ico([16, 32, 48].map((s) => ({ size: s, png: bytes(canvas(o, s).toDataURL('image/png')) })))], { type: 'image/x-icon' }),
      ),
    }),
    Object.assign(document.createElement('a'), {
      className: 'btn primary',
      textContent: 'SVG',
      download: 'favicon.svg',
      href: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgIcon(o)),
    }),
  );
}
$('#tags').textContent = linkTags;
document.addEventListener('input', (e) => {
  if (['text', 'shape', 'weight', 'grad'].includes(e.target.id)) render();
});
$('#copy').addEventListener('click', async (e) => {
  const b = e.currentTarget;
  try {
    await navigator.clipboard.writeText(linkTags);
    b.textContent = 'Copied';
  } catch {
    getSelection().selectAllChildren($('#tags'));
    b.textContent = 'Press Ctrl+C';
  }
  setTimeout(() => (b.textContent = 'Copy tags'), 1500);
});
render();
