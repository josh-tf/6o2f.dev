# 6o2f.dev — how a tool is built

One Worker (`src/index.ts`) serves everything. `6o2f.dev` = dashboard + Discord login (`src/auth.ts`, `public/_/dash`).
`<name>.6o2f.dev` is routed to `src/tools/<name>/index.ts`, which exports `tool: Tool` (`src/tools/types.ts`): a Hono app
answering **every** request on that host. Tools are registered in `src/tools/index.ts` (already done — don't edit it).

## Auth

- `gate` (from `../../auth.ts`) = login required: session cookie (browser, shared across `*.6o2f.dev`) or
  `Authorization: Bearer 6o2f_…` (curl). Browsers asking for HTML get redirected to Discord login; others get 401 JSON.
  `c.get('user')` → `{ id, name, avatar, isAdmin, via }`. `adminOnly` after `gate` restricts to admins.
- **Policy:** the web UI and every management/write API is behind `gate`. Machine endpoints that other systems must hit
  without credentials are public by design (listed per tool in the task: hook receivers, `s` redirects, raw paste
  reads, drop download links, ip text/json, mock endpoints). Public endpoints must be safe for the open internet:
  size limits, no reflection of untrusted HTML, `x-content-type-options: nosniff` (added globally), and untrusted
  content served from tool hosts must be `text/plain` / `content-disposition: attachment` / CSP `sandbox`, because the
  session cookie is shared across `*.6o2f.dev`.
- Cookie-authenticated writes are CSRF-checked inside `gate` (Origin must equal the host). Bearer requests skip that.

## UI (no build step, no framework)

- Page for the host's `/` lives in `public/_/<name>/index.html` (+ `app.js`, optional `style.css`), served by
  `return page(c, '<name>')` after `gate`. Files under `/_/` are static assets served straight from `public/`.
- Include `<link rel="stylesheet" href="/_/ui.css">` and `<header class="bar"></header>`; in a module script
  `import { $, api, esc, mountBar } from '/_/ui.js'`; call `mountBar('Title')`. Read `public/_/ui.css`, `ui.js` and
  `public/_/dash/` first and match their look: simple, clean, light/dark, mobile-friendly, accessible labels.
- **CSP forbids inline `<script>` and inline event handlers** (`script-src 'self'`); inline `style=` is fine. Always
  escape untrusted text with `esc()` or `textContent`.

## Storage bindings (see `wrangler.jsonc`, types in `worker-configuration.d.ts`)

`DB` (D1, shared users/tokens; a tool needing tables adds ONE migration `migrations/<NNNN>_<tool>.sql` with the number
it was assigned, tables prefixed `<tool>_`), `PASTE` + `LINKS` (KV), `DROP` (R2), `HOOK` (Durable Object `HookInbox`,
`src/tools/hook/inbox.ts`), `MAILDB` + `MAIL` (mail only). Don't edit `wrangler.jsonc`, `src/index.ts`, `src/auth.ts`,
`src/tools/index.ts`, `public/_/ui.*`, `public/_/dash`; if something there must change, say so in your final report.

## Local dev & checks

- `scripts/dev.sh <slot>` runs an isolated dev server (port 8850+slot, own state) with an admin dev token seeded.
  Start it with `run_in_background`; talk to a tool via `curl -H 'x-host: <name>.6o2f.dev' -H 'authorization: Bearer 6o2f_devtoken0000000000000000' localhost:<port>/…`
  (public endpoints: omit the token). Always stop your server when finished.
- `pnpm exec tsc --noEmit` must pass for your files. Put pure logic in small functions and add one
  `src/tools/<name>/*.test.ts` using `node:test` (run: `node --test --experimental-strip-types --no-warnings <file>`).
  Test the real behaviour with curl against your dev server too — a green typecheck is not "it works".
- Keep it small: shortest code that fully meets the brief. Mark deliberate ceilings with a `ponytail:` comment.
- Only touch your own files: `src/tools/<name>/**`, `public/_/<name>/**`, your migration. Don't run git commands; the
  orchestrator commits. Never deploy and never run remote wrangler commands (no `--remote`).

## Update: 50 tools (read this section too)

- **Launcher metadata lives in your tool file.** `src/tools/<name>/index.ts` exports `tool` with `title` (1-2 words), `blurb` (under ~35 chars),
  `icon` (inner markup of a 24x24 lucide-style stroke icon: `<path>/<circle>/<rect>/<line>` only, no `<svg>` wrapper, no fill or stroke attributes;
  make it distinctive and unlike the other tools'), `note` (one line for the launcher's details panel: what is public vs needs sign-in) and `public: true`
  when the page needs no login. The launcher reads these through `/api/tools`; do not edit the dashboard or the registry (both already list your tool).
- A stub already exists for your tools: `src/tools/<name>/index.ts` and `public/_/<name>/{index.html,app.js,style.css}`. Replace the placeholder icon/note and build the real thing.
- **Client-only tools** (public): all logic in `public/_/<name>/` (put pure logic in `lib.js`, an ES module, and test it from
  `src/tools/<name>/lib.test.ts` with `// @ts-ignore` on the import). Nothing is sent to a server; no network calls. The CSP is `script-src 'self'`: no CDN scripts, no inline scripts, no eval/new Function.
  If you need a library, vendor ONE minified file (keep its license header) into `public/_/<name>/vendor/` using `npm pack <pkg> --pack-destination <scratch>` and extracting it; do NOT edit package.json or the lockfile.
- **Worker tools** (locked: gate): routes under `/api/*` on the tool's host, JSON errors via `fail()` from `../../auth.ts`. For ANY request to a user-supplied URL use `safeFetch` / `checkUrl` from `../../net.ts` (SSRF guard, redirects re-validated, timeout, size cap). Never use bare `fetch()` on user input.
- Migrations reserved: stash `0005_stash.sql`, uptime `0006_uptime.sql`, rss `0007_rss.sql` (tables prefixed with the tool name). KV `CLIP` is for clip. `uptime` implements `runUptime(env)` (exported from its index.ts, called every 5 minutes by cron).
- Pages must work at phone width, support light and dark through `ui.css` tokens only (no hard-coded colors except data like a color picker's output), be keyboard-accessible, have labelled controls, and show a realistic example state on load (e.g. sample JSON loaded) rather than an empty shell.
- Use your assigned dev slot with `scripts/dev.sh <slot>` (ports 8850+slot) and stop it when finished.

## Update: 100 tools, quality bar, audit

- **Routing:** every `<tool>.6o2f.dev` is served by the wildcard route; a new tool needs only its entry in `src/tools/index.ts` (already done for yours). No wrangler changes per tool.
- **Standard head tags are injected by the Worker** (description, theme-color, Open Graph, canonical, noindex for locked tools): do NOT add them to your HTML. Your `index.html` keeps: charset, viewport, `<title>`, ui.css, your own css, favicon link.
- **Page skeleton:** `<header class="bar"></header><main>` + one `<h1>` + `<p class="sub">` + sections with `<h2>` (never skip heading levels) + `</main>` + one module script. Do not nest `<main>`.
- **HTML quality bar (the audit enforces most of it):**
  every control has a visible `<label for>` (placeholders are not labels); related controls grouped in `<fieldset><legend>`; every `<button>` has `type="button"` (or `submit` in a real `<form>`); icon-only buttons have `aria-label`;
  async results/status in `role="status"` (polite) and errors in `role="alert"`; computed results in `<output>` where it fits; tables have `<caption>` (can be visually hidden), `<th scope>`; keyboard shortcuts shown with `<kbd>`;
  use the right input types and attributes: `type=number` with `min/max/step`, `inputmode`, `autocomplete="off"` on non-credential fields, `spellcheck="false"` and `autocapitalize="off"` on code/ids, `accept` on file inputs, `type=url`/`email` when apt; `rel="noopener noreferrer"` on `target=_blank`; `<time datetime>` for dates, `<code>/<pre>` for code, `<details>/<summary>` for help text;
  all interactive things work with keyboard alone and have a visible focus style (ui.css gives one; don't remove outlines); touch targets ≥ 32px; no horizontal scroll at 400px; contrast ≥ 4.5:1 using ui.css tokens only; respects prefers-reduced-motion;
  every page has a realistic example loaded, a clear empty state, and readable error messages; copy buttons use the shared pattern (clipboard API in the click handler with a select-text fallback); never `alert/confirm/prompt`.
- **Shared controls:** number inputs are enhanced automatically by ui.js (do not build your own steppers), selects/file inputs are styled by ui.css, the colour picker lives in `public/_/color/picker.js` (import it if you need a colour picker).
- **Audit:** `scripts/dev.sh <slot>` in the background, then `node scripts/audit.mjs --slot <slot> <tool> [<tool>...]` (add `--shots /tmp/claude-1002/shots-<slot>` for screenshots). It loads each page at 1100px dark/light and 400px, collects console/CSP errors, runs axe-core (WCAG 2 A/AA + best practices), checks focus visibility, labels, heading structure, button types, titles, h1, landmarks, horizontal scroll. A tool is done only when it reports 0 errors. LOOK at the screenshots too: the audit cannot judge layout or usefulness.
- **Shared files are read-only for you** (ui.css, ui.js, dash/, index.ts files, wrangler.jsonc, CONTRACT.md). If a fix would need one, put it in `sharedProposals` with the exact change and why.

## Update: shared utilities in ui.css / ui.js

- ui.css now provides `.vh` / `.sr` (visually hidden), a themed `fieldset`/`legend`, `kbd`, range `accent-color`, a focus ring on native date/time inputs (`:focus-within`), and turns off font ligatures in code-ish elements. Use these instead of per-tool copies.
- `span.num` is the stepper wrapper ui.js creates around number inputs; don't use `num` as a class on spans for anything else.
- `mountBar()` sets `document.title` synchronously; a page that wants its own title (share pages, deep links) sets it after calling `mountBar`.
- Scrollable table wrappers need `tabindex="0" role="region" aria-label="…"` (axe `scrollable-region-focusable`).
- The Worker adds `canonical`/`og:url` only on a tool's `/`; other HTML routes (share pages) get no canonical.
