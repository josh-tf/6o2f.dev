// chmod / umask maths. A mode is an integer 0..0o7777 (setuid 4000, setgid 2000, sticky 1000, then rwx for user/group/other).
export const SETUID = 0o4000,
  SETGID = 0o2000,
  STICKY = 0o1000;
const WHO = { u: 6, g: 3, o: 0 };

/** Parse an octal string ("755", "0755", "2775", "0o644"). Returns an integer or null. */
export function parseOctal(s) {
  const m = /^(?:0o)?([0-7]{3,4})$/i.exec(String(s).trim());
  return m ? parseInt(m[1], 8) : null;
}
export function toOctal(mode) {
  const o = (mode & 0o7777).toString(8);
  return mode & 0o7000 ? o.padStart(4, '0') : o.padStart(3, '0').padStart(4, '0');
}

/** 'rwxr-xr-x' (9 chars) with s/S/t/T for the special bits, exactly as ls -l prints it. */
export function toLs(mode) {
  let out = '';
  for (const [i, who] of [
    [6, 'u'],
    [3, 'g'],
    [0, 'o'],
  ]) {
    const b = (mode >> i) & 7;
    const sp = who === 'u' ? mode & SETUID : who === 'g' ? mode & SETGID : mode & STICKY;
    out += b & 4 ? 'r' : '-';
    out += b & 2 ? 'w' : '-';
    out += sp ? (b & 1 ? (who === 'o' ? 't' : 's') : who === 'o' ? 'T' : 'S') : b & 1 ? 'x' : '-';
  }
  return out;
}
/** Parse 9 chars, or 10 with a leading file-type char (-, d, l, c, b, p, s). Returns { mode, type } or null. */
export function parseLs(s) {
  const t = String(s).trim();
  const m = /^([-dlcbps])?([r-][w-][xsS-])([r-][w-][xsS-])([r-][w-][xtT-])$/.exec(t);
  if (!m) return null;
  let mode = 0;
  [m[2], m[3], m[4]].forEach((tri, i) => {
    const sh = 6 - i * 3,
      [r, w, x] = tri;
    if (r === 'r') mode |= 4 << sh;
    if (w === 'w') mode |= 2 << sh;
    if ('xst'.includes(x)) mode |= 1 << sh;
    if (x === 's' || x === 'S' || x === 't' || x === 'T') {
      if (i === 0 && 'sS'.includes(x)) mode |= SETUID;
      else if (i === 1 && 'sS'.includes(x)) mode |= SETGID;
      else if (i === 2 && 'tT'.includes(x)) mode |= STICKY;
    }
  });
  // s is only valid in user/group, t only in other; the regexes allow s in other: reject.
  if (/[sS]/.test(m[4]) || /[tT]/.test(m[2] + m[3])) return null;
  return { mode, type: m[1] ?? '-' };
}

/** Canonical clause form: u=rwx,g=rx,o=rx (s = setuid/setgid, t = sticky). */
export function toClauses(mode) {
  const f = (i, sp, ch) => ((mode >> i) & 4 ? 'r' : '') + ((mode >> i) & 2 ? 'w' : '') + ((mode >> i) & 1 ? 'x' : '') + (sp ? ch : '');
  return `u=${f(6, mode & SETUID, 's')},g=${f(3, mode & SETGID, 's')},o=${f(0, mode & STICKY, 't')}`;
}

/**
 * Apply a chmod symbolic expression ("u=rwx,go=rx", "a+x", "g-w,o=", "+x") to `base`.
 * Also accepts a bare 9-char "rwxr-xr-x" string. Returns { mode } or { error }.
 * With no who letter GNU chmod honours the umask; here it means "all" (documented in the UI).
 */
export function applySymbolic(expr, base = 0) {
  const s = String(expr).trim();
  if (!s) return { error: 'Type a mode such as u=rwx,go=rx or a+x.' };
  const ls = parseLs(s);
  if (ls && s.length >= 9) return { mode: ls.mode };
  let mode = base & 0o7777;
  for (const clause of s.split(',')) {
    const m = /^([ugoa]*)((?:[-+=][rwxXst]*|[-+=][ugo])+)$/.exec(clause);
    if (!m) return { error: `Can't read "${clause}". Use who (u g o a), an operator (+ - =) and permissions (r w x X s t), e.g. g+w.` };
    const who = m[1] || 'a';
    const targets = [...new Set(who.includes('a') ? 'ugo' : who)];
    for (const [, op, perms] of m[2].matchAll(/([-+=])([ugo]|[rwxXst]*)/g)) {
      let bits = 0,
        special = 0;
      if (/^[ugo]$/.test(perms))
        bits = (mode >> WHO[perms]) & 7; // copy another class's bits
      else
        for (const p of perms) {
          if (p === 'r') bits |= 4;
          else if (p === 'w') bits |= 2;
          else if (p === 'x') bits |= 1;
          else if (p === 'X') {
            if (mode & 0o111 || base & 0o40000) bits |= 1;
          } // X: only if already executable
          else if (p === 's') special |= (targets.includes('u') ? SETUID : 0) | (targets.includes('g') ? SETGID : 0);
          else if (p === 't') special |= STICKY;
        }
      for (const t of targets) {
        const sh = WHO[t],
          mask = 7 << sh,
          spMask = t === 'u' ? SETUID : t === 'g' ? SETGID : STICKY;
        const spBit = t === 'o' ? special & STICKY : special & spMask;
        if (op === '+') mode |= (bits << sh) | spBit;
        else if (op === '-') mode &= ~(bits << sh) & ~spBit;
        else {
          mode = (mode & ~mask & ~spMask) | (bits << sh) | spBit;
        }
      }
    }
  }
  return { mode: mode & 0o7777 };
}

/** Shell-quote a filename only when needed. */
export function shq(s) {
  return /^[\w@%+=:,./-]+$/.test(s) ? s : `'${s.replace(/'/g, `'\\''`)}'`;
}
export function command(mode, { file = 'file', recursive = false } = {}) {
  return `chmod ${recursive ? '-R ' : ''}${toOctal(mode).replace(/^0(?=\d{3}$)/, '')} ${shq(file || 'file')}`;
}

const who = (b, can) => (b & 7 ? `${can}: ${[b & 4 && 'read', b & 2 && 'write', b & 1 && 'execute'].filter(Boolean).join(', ')}` : `${can}: nothing`);
/** One-line plain-English description. */
export function explain(mode) {
  const bits = [(mode >> 6) & 7, (mode >> 3) & 7, mode & 7];
  const names = ['Owner', 'Group', 'Everyone else'];
  const parts = bits.map((b, i) => who(b, names[i]));
  if (bits[1] === bits[2]) parts.splice(1, 2, who(bits[1], 'Group and everyone else'));
  return parts.join('. ') + '.';
}
/** Things worth knowing about a mode, as { level: 'warn'|'info', text }. */
export function notes(mode) {
  const out = [];
  if (mode & 2 && !(mode & STICKY))
    out.push({
      level: 'warn',
      text: 'World-writable: any user on the system can modify this. Almost never right for files, and for a directory anyone can delete or replace its contents.',
    });
  if (mode & 2 && mode & STICKY)
    out.push({ level: 'info', text: 'World-writable but sticky: users can only delete or rename their own files here (like /tmp).' });
  if (mode & SETUID)
    out.push({
      level: 'warn',
      text: "Setuid: runs with the owner's privileges. On a root-owned program a bug becomes a privilege escalation. Ignored on scripts and, on most systems, on directories.",
    });
  if (mode & SETGID)
    out.push({
      level: 'info',
      text: "Setgid: on a program it runs as the file's group; on a directory, new files inherit the directory's group (handy for shared folders).",
    });
  if (mode & STICKY && !(mode & 2)) out.push({ level: 'info', text: 'Sticky: only the owner (or root) can delete or rename entries in this directory.' });
  if (mode & 4) out.push({ level: 'info', text: 'World-readable: any local user can read it. Keep secrets (keys, .env) out of this.' });
  if (mode & 0o111 && !(mode & 0o400))
    out.push({ level: 'info', text: 'Executable but not readable by the owner: scripts need read permission to run via an interpreter.' });
  if (!(mode & 0o700)) out.push({ level: 'info', text: 'The owner has no access at all (root can still use it).' });
  const [u, g, o] = [(mode >> 6) & 7, (mode >> 3) & 7, mode & 7];
  if ((g | o) & ~u)
    out.push({
      level: 'info',
      text: 'Unusual: group or others have a permission the owner lacks. Only the first matching class counts (owner, then group, then others), so the owner gets just the owner bits.',
    });
  else if (o & ~g)
    out.push({
      level: 'info',
      text: 'Unusual: others have a permission the group lacks, so group members get less access than strangers. Only the first matching class counts.',
    });
  return out;
}

export const PRESETS = [
  {
    mode: 0o644,
    use: 'Regular files',
    what: 'Owner reads and writes; everyone else reads. The default for most files and web content.',
    sec: 'World-readable, so no secrets. Fine for HTML, source and config without credentials.',
  },
  {
    mode: 0o755,
    use: 'Programs and directories',
    what: 'Owner has full access; everyone else can read and execute (and enter directories). The default for scripts, binaries and directories.',
    sec: 'Others can run it and read the contents; safe as long as nobody else can write.',
  },
  {
    mode: 0o600,
    use: 'Private files',
    what: 'Only the owner can read and write. Nobody else can do anything.',
    sec: 'Required for SSH private keys (ssh refuses looser), .netrc, .pgpass and similar. Use for secrets.',
  },
  {
    mode: 0o700,
    use: 'Private programs and directories',
    what: 'Only the owner can read, write, execute or enter.',
    sec: 'Right for ~/.ssh, ~/.gnupg and private scripts.',
  },
  {
    mode: 0o777,
    use: 'Almost never',
    what: 'Everyone can read, write and execute.',
    sec: 'Any user or compromised service can replace the file or plant files. It is a common "fix" for permission errors that hides the real problem (wrong owner or group): fix those instead.',
  },
  {
    mode: 0o400,
    use: 'Read-only secrets',
    what: 'Owner can read; nobody can write or execute.',
    sec: 'Good for keys and certificates that must not change. The owner can still chmod it back.',
  },
  {
    mode: 0o2775,
    use: 'Shared team directories',
    what: "Like 775 plus setgid: group members have full access, and new files inherit the directory's group.",
    sec: "Everyone in the group can edit and delete each other's files. Others can read and enter.",
  },
  {
    mode: 0o1777,
    use: 'Shared scratch space',
    what: "Everyone can create files, but the sticky bit stops users deleting or renaming other people's.",
    sec: 'This is /tmp. Safe for sharing; files are still world-writable unless created with a tighter mode.',
  },
];

/** Parse a umask ("022", "0027"). Returns an integer or null. */
export const parseUmask = (s) => {
  const m = /^(?:0o)?([0-7]{3,4})$/i.exec(String(s).trim());
  return m ? parseInt(m[1], 8) & 0o777 : null;
};
/** New files start at 666 and new directories at 777; the umask clears bits (masking, not subtraction). */
export const umaskResult = (u) => ({ file: 0o666 & ~u & 0o777, dir: 0o777 & ~u & 0o777 });
/** Reverse: the umask that yields a directory mode (dir bits are the complement). */
export const UMASKS = [
  { v: 0o022, what: 'Default on most distros: files 644, directories 755. Others can read.' },
  { v: 0o002, what: 'Default with per-user groups (Debian, Ubuntu): files 664, directories 775. Group can write.' },
  { v: 0o027, what: 'Group can read, others get nothing: files 640, directories 750.' },
  { v: 0o077, what: 'Private: only the owner gets access. Files 600, directories 700.' },
  { v: 0o007, what: 'Group-shared, others locked out: files 660, directories 770.' },
  { v: 0o000, what: 'Nothing is masked: files 666, directories 777. Avoid.' },
];
