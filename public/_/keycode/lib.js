// Pure helpers for the key code inspector. `e` is anything shaped like a KeyboardEvent.

export const LOCATIONS = ['Standard', 'Left', 'Right', 'Numpad'];

/** Readable name for event.key: ' ' is invisible, everything else is shown as is. */
export const keyLabel = (key) => (key === ' ' ? 'Space' : key === '' ? '(empty)' : key);

/** Modifiers held during the event, in the conventional shortcut order. */
export function modifiers(e) {
  const m = [];
  if (e.ctrlKey) m.push('Ctrl');
  if (e.altKey) m.push('Alt');
  if (e.shiftKey) m.push('Shift');
  if (e.metaKey) m.push('Meta');
  return m;
}

const MOD_KEYS = new Set(['Control', 'Alt', 'Shift', 'Meta', 'AltGraph', 'CapsLock', 'Fn', 'FnLock', 'Hyper', 'Super', 'OS']);

/** Shortcut string like "Ctrl+Shift+K". A lone modifier is shown on its own; letters are upper-cased. */
export function shortcut(e) {
  const k = e.key ?? '';
  if (MOD_KEYS.has(k)) return k === 'Control' ? 'Ctrl' : k;
  const name = k === ' ' ? 'Space' : k.length === 1 ? k.toUpperCase() : k;
  return [...modifiers(e), name].join('+');
}

const js = (s) => JSON.stringify(s);

/** A JavaScript condition that matches this key press, by `key` (what was typed) and by `code` (physical key). */
export function snippets(e) {
  const mods = modifiers(e).filter((m) => !(MOD_KEYS.has(e.key) && m === (e.key === 'Control' ? 'Ctrl' : e.key)));
  const prop = { Ctrl: 'ctrlKey', Alt: 'altKey', Shift: 'shiftKey', Meta: 'metaKey' };
  // Shift changes event.key for printable keys ("k" → "K"), so a key-based check already encodes it.
  const keyMods = mods.filter((m) => !(m === 'Shift' && (e.key ?? '').length === 1));
  const cond = (base, ms) => [base, ...ms.map((m) => `e.${prop[m]}`)].join(' && ');
  return {
    key: cond(`e.key === ${js(e.key ?? '')}`, keyMods),
    code: cond(`e.code === ${js(e.code ?? '')}`, mods),
  };
}

/** Everything the page shows for one event. */
export function describe(e) {
  return {
    key: e.key ?? '',
    label: keyLabel(e.key ?? ''),
    code: e.code || '(none)',
    keyCode: e.keyCode ?? 0,
    which: e.which ?? 0,
    location: e.location ?? 0,
    locationName: LOCATIONS[e.location] ?? String(e.location),
    modifiers: modifiers(e),
    repeat: !!e.repeat,
    composing: !!e.isComposing,
    shortcut: shortcut(e),
    // Virtual keyboards and IMEs report "Unidentified" / keyCode 229: the real character only arrives in the input event.
    virtual: e.key === 'Unidentified' || e.keyCode === 229,
  };
}

/** Common keys and their legacy keyCode (Chrome/Safari values; Firefox differs for ; = - as 59, 61, 173). */
export const COMMON = [
  ['Backspace', 'Backspace', 8],
  ['Tab', 'Tab', 9],
  ['Enter', 'Enter', 13],
  ['Shift', 'ShiftLeft', 16],
  ['Control', 'ControlLeft', 17],
  ['Alt', 'AltLeft', 18],
  ['Pause', 'Pause', 19],
  ['CapsLock', 'CapsLock', 20],
  ['Escape', 'Escape', 27],
  [' ', 'Space', 32],
  ['PageUp', 'PageUp', 33],
  ['PageDown', 'PageDown', 34],
  ['End', 'End', 35],
  ['Home', 'Home', 36],
  ['ArrowLeft', 'ArrowLeft', 37],
  ['ArrowUp', 'ArrowUp', 38],
  ['ArrowRight', 'ArrowRight', 39],
  ['ArrowDown', 'ArrowDown', 40],
  ['Insert', 'Insert', 45],
  ['Delete', 'Delete', 46],
  ['0', 'Digit0', 48],
  ['9', 'Digit9', 57],
  ['a', 'KeyA', 65],
  ['z', 'KeyZ', 90],
  ['Meta', 'MetaLeft', 91],
  ['0', 'Numpad0', 96],
  ['F1', 'F1', 112],
  ['F12', 'F12', 123],
  ['NumLock', 'NumLock', 144],
  [';', 'Semicolon', 186],
  ['=', 'Equal', 187],
  [',', 'Comma', 188],
  ['-', 'Minus', 189],
  ['.', 'Period', 190],
  ['/', 'Slash', 191],
  ['`', 'Backquote', 192],
  ['[', 'BracketLeft', 219],
  ['\\', 'Backslash', 220],
  [']', 'BracketRight', 221],
  ["'", 'Quote', 222],
];
