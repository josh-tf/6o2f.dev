import { $, mountBar } from '/_/ui.js';
import { contrastWarning, draw, mailto, matrix, svg, tel, wifi } from './lib.js';
mountBar('QR code');
const payload = () =>
  ({
    text: () => $('#text').value,
    wifi: () => wifi({ ssid: $('#ssid').value, pass: $('#pass').value, sec: $('#sec').value, hidden: $('#hidden').checked }),
    email: () => mailto({ to: $('#to').value, subject: $('#subject').value, body: $('#body').value }),
    phone: () => tel($('#tel').value),
  })[$('#kind').value]();
function render() {
  for (const k of ['text', 'wifi', 'email', 'phone']) $('#f-' + k).hidden = k !== $('#kind').value;
  const o = {
    fg: $('#fg').value,
    bg: $('#bg').value,
    quiet: Math.min(20, Math.max(0, Math.floor(+$('#quiet').value) || 0)),
    scale: Math.min(50, Math.max(1, Math.floor(+$('#scale').value) || 1)),
  };
  $('#pass').disabled = $('#sec').value === 'nopass';
  const text = payload();
  $('#warn').textContent = contrastWarning(o.fg, o.bg);
  for (const a of ['png', 'svg']) $('#' + a).toggleAttribute('hidden', !text);
  $('#cv').hidden = !text;
  if (!text)
    return ($('#info').textContent = {
      text: 'Enter some text or a URL.',
      wifi: 'Enter the network name.',
      email: 'Enter an email address.',
      phone: 'Enter a phone number.',
    }[$('#kind').value]);
  let m;
  try {
    m = matrix(text, $('#ecc').value);
  } catch {
    $('#png').hidden = $('#svg').hidden = $('#cv').hidden = true;
    $('#warn').textContent = 'Too much data for a QR code at this error-correction level. Shorten it or lower the level.';
    return ($('#info').textContent = '');
  }
  const px = draw($('#cv'), m, o);
  $('#cv').style.width = Math.min(px, 360) + 'px';
  $('#info').textContent = `${m.length} x ${m.length} modules (version ${(m.length - 17) / 4}), ${px} x ${px} px with quiet zone`;
  $('#png').href = $('#cv').toDataURL('image/png');
  $('#svg').href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(m, o));
}
document.addEventListener('input', render);
render();
