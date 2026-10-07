// Hex/CSS colour text field + the shared themed picker (also used by the shadow tool).
import { makePicker } from '/_/color/picker.js';
import { parse, toHex } from '/_/color/lib.js';

/** Markup for one field; `id` labels the text input. */
export const colorFieldHtml = (id, value, label) =>
  `<span class="cf"><span class="pickwrap"><button type="button" class="swbtn" aria-label="Pick ${label}"></button></span><label class="vh" for="${id}">${label}</label><input id="${id}" class="cfin" value="${value}" autocomplete="off" spellcheck="false" autocapitalize="off" maxlength="40"></span>`;

/** Wire every .cf inside root; onColor(input, '#rrggbb') fires for picker moves and valid typed colours. */
export function wireColorFields(root, onColor) {
  for (const wrap of root.querySelectorAll('.cf')) {
    const input = wrap.querySelector('input');
    // ponytail: each picker adds one document listener and they are not removed on re-render; fine for a handful of re-renders.
    const p = makePicker(wrap.querySelector('.swbtn'), input, () => {
      input.removeAttribute('aria-invalid');
      onColor(input, input.value);
    });
    p.set(input.value);
    input.addEventListener('input', () => {
      const c = parse(input.value);
      input.setAttribute('aria-invalid', String(!c));
      if (c) {
        const hex = toHex({ ...c, a: 1 });
        p.set(hex);
        onColor(input, hex);
      }
    });
    input.addEventListener('change', () => {
      const c = parse(input.value);
      if (c) input.value = toHex({ ...c, a: 1 });
    });
  }
}
