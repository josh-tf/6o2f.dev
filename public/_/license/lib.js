// Licence metadata, placeholder filling and the 3-question chooser. Texts live in texts.js.
import { TEXTS } from './texts.js';

// kind: 'full' = put the whole text in LICENSE; 'notice' = per-file header, full text from `url`.
// Permissions/conditions/limitations follow choosealicense.com.
const P4 = ['commercial', 'modify', 'distribute', 'private'];
export const LICENSES = {
  MIT: { name: 'MIT', kind: 'full', url: 'https://opensource.org/license/mit', perms: P4, conds: ['notice'], limits: ['liability', 'warranty'] },
  'BSD-2-Clause': {
    name: 'BSD 2-Clause',
    kind: 'full',
    url: 'https://opensource.org/license/bsd-2-clause',
    perms: P4,
    conds: ['notice'],
    limits: ['liability', 'warranty'],
  },
  'BSD-3-Clause': {
    name: 'BSD 3-Clause',
    kind: 'full',
    url: 'https://opensource.org/license/bsd-3-clause',
    perms: P4,
    conds: ['notice'],
    limits: ['liability', 'warranty', 'trademark'],
  },
  ISC: { name: 'ISC', kind: 'full', url: 'https://opensource.org/license/isc-license-txt', perms: P4, conds: ['notice'], limits: ['liability', 'warranty'] },
  '0BSD': { name: 'Zero-Clause BSD', kind: 'full', url: 'https://opensource.org/license/0bsd', perms: P4, conds: [], limits: ['liability', 'warranty'] },
  Unlicense: { name: 'Unlicense', kind: 'full', url: 'https://unlicense.org/', perms: P4, conds: [], limits: ['liability', 'warranty'], noHolder: true },
  'CC0-1.0': {
    name: 'CC0 1.0',
    kind: 'full',
    url: 'https://creativecommons.org/publicdomain/zero/1.0/legalcode.txt',
    perms: P4,
    conds: [],
    limits: ['liability', 'warranty', 'trademark', 'nopatent'],
    noHolder: true,
  },
  'Apache-2.0': {
    name: 'Apache 2.0',
    kind: 'notice',
    url: 'https://www.apache.org/licenses/LICENSE-2.0.txt',
    perms: [...P4, 'patent'],
    conds: ['notice', 'changes'],
    limits: ['liability', 'warranty', 'trademark'],
  },
  'MPL-2.0': {
    name: 'MPL 2.0',
    kind: 'notice',
    url: 'https://www.mozilla.org/media/MPL/2.0/index.txt',
    perms: [...P4, 'patent'],
    conds: ['notice', 'source', 'same-file'],
    limits: ['liability', 'warranty', 'trademark'],
    noHolder: true,
  },
  'LGPL-3.0-or-later': {
    name: 'LGPL 3.0',
    kind: 'notice',
    url: 'https://www.gnu.org/licenses/lgpl-3.0.txt',
    also: 'https://www.gnu.org/licenses/gpl-3.0.txt',
    perms: [...P4, 'patent'],
    conds: ['notice', 'changes', 'source', 'same-lib'],
    limits: ['liability', 'warranty'],
  },
  'GPL-3.0-or-later': {
    name: 'GPL 3.0',
    kind: 'notice',
    url: 'https://www.gnu.org/licenses/gpl-3.0.txt',
    perms: [...P4, 'patent'],
    conds: ['notice', 'changes', 'source', 'same'],
    limits: ['liability', 'warranty'],
  },
  'AGPL-3.0-or-later': {
    name: 'AGPL 3.0',
    kind: 'notice',
    url: 'https://www.gnu.org/licenses/agpl-3.0.txt',
    perms: [...P4, 'patent'],
    conds: ['notice', 'changes', 'source', 'same', 'network'],
    limits: ['liability', 'warranty'],
  },
};
for (const id in LICENSES) LICENSES[id].text = TEXTS[id];

/** Comparison columns: [key, label, group]. */
export const COLUMNS = [
  ['commercial', 'Commercial use', 'perms'],
  ['modify', 'Modify', 'perms'],
  ['distribute', 'Distribute', 'perms'],
  ['patent', 'Patent grant', 'perms'],
  ['notice', 'Keep licence notice', 'conds'],
  ['changes', 'State changes', 'conds'],
  ['source', 'Disclose source', 'conds'],
  ['same', 'Same licence', 'conds'],
  ['network', 'Network use counts', 'conds'],
  ['liability', 'No liability', 'limits'],
  ['warranty', 'No warranty', 'limits'],
  ['trademark', 'No trademark rights', 'limits'],
];
/** Value for a comparison cell: true / false / a short qualifier. */
export function cell(id, col) {
  const l = LICENSES[id];
  if (col === 'same') return l.conds.includes('same') ? 'yes' : l.conds.includes('same-file') ? 'per file' : l.conds.includes('same-lib') ? 'library' : '';
  if (col === 'patent' && l.limits.includes('nopatent')) return 'excluded';
  return l.perms.includes(col) || l.conds.includes(col) || l.limits.includes(col) ? 'yes' : '';
}

/** Validate inputs and fill {{year}}, {{holder}}, {{project}}. Returns { text, warnings }. */
export function fill(id, { year = '', holder = '', project = '' } = {}) {
  const l = LICENSES[id];
  if (!l) throw new Error(`Unknown licence ${id}.`);
  const warnings = [];
  const y = String(year).trim(),
    h = String(holder).trim().replace(/\s+/g, ' '),
    p = String(project).trim().replace(/\s+/g, ' ');
  if (!l.noHolder) {
    if (!y) warnings.push('Enter a year.');
    else if (!/^\d{4}(\s*[-–,]\s*\d{4})*$/.test(y)) warnings.push('The year should look like 2026, 2019-2026 or 2019, 2024.');
    if (!h) warnings.push('Enter the copyright holder (your name or organisation).');
  }
  let text = l.text.replaceAll('{{year}}', y || '[year]').replaceAll('{{holder}}', h || '[copyright holder]');
  text = text.replaceAll('{{project}}', p || '[program name]: [one line describing what it does]');
  return { text, warnings };
}

/**
 * The chooser. style: 'permissive' | 'weak' | 'strong' | 'none'; patents: bool (permissive only); network: bool (strong only).
 * Returns { id, why, alt }.
 */
export function recommend({ style, patents, network }) {
  if (style === 'none')
    return { id: '0BSD', why: 'No conditions at all, not even keeping a copyright notice, while still disclaiming warranty.', alt: ['Unlicense', 'CC0-1.0'] };
  if (style === 'weak')
    return {
      id: 'MPL-2.0',
      why: 'Changes to your files must stay open, but your files can be combined with code under any licence, and it includes a patent grant.',
      alt: ['LGPL-3.0-or-later'],
    };
  if (style === 'strong')
    return network
      ? {
          id: 'AGPL-3.0-or-later',
          why: 'Like the GPL, and people who run a modified version as a network service must offer its source to users.',
          alt: ['GPL-3.0-or-later'],
        }
      : {
          id: 'GPL-3.0-or-later',
          why: 'Anyone who distributes your program or a derivative must release the whole source under the GPL, with a patent grant.',
          alt: ['AGPL-3.0-or-later'],
        };
  return patents
    ? { id: 'Apache-2.0', why: 'Permissive, with an explicit patent licence from contributors and a patent-retaliation clause.', alt: ['MIT'] }
    : { id: 'MIT', why: 'Short, permissive and the most widely used: keep the notice, do anything else.', alt: ['ISC', 'BSD-2-Clause', 'Apache-2.0'] };
}
