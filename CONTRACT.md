# Tool contract

This is the current guide for adding or changing a tool on 6o2f.dev. For project setup and deployment, see [README.md](README.md).

## Routing and metadata

One Cloudflare Worker (`src/index.ts`) serves the launcher at `6o2f.dev` and routes `<name>.6o2f.dev` to a Hono app exported as `tool` from `src/tools/<name>/index.ts`. Register new tools in `src/tools/index.ts`; the launcher order is defined there. See `src/tools/types.ts` for the `Tool` type.

Each tool supplies a short `title` and `blurb`, a distinctive 24 × 24 stroke-icon fragment, and a `note` explaining access. Set `public: true` when its page needs no sign-in. Set `curl` to an example command for public terminal tools; these appear in the plain-text menu returned by `curl 6o2f.dev`.

## Access and safety

Use `gate` from `src/auth.ts` for pages and management or write APIs that require sign-in. It accepts a session cookie or `Authorization: Bearer 6o2f_…`; use `adminOnly` after `gate` for admin routes. Cookie-authenticated writes receive an Origin check. Public machine endpoints must be deliberately scoped and safe for unauthenticated requests.

Limit request sizes. Serve untrusted content as plain text, an attachment, or under a sandboxed CSP: session cookies are shared across tool subdomains. The Worker adds `X-Content-Type-Options: nosniff`. For requests to user-supplied URLs, use `safeFetch` or `checkUrl` from `src/net.ts` so redirects, timeouts, sizes, and private addresses are checked. Do not pass user input directly to `fetch()`.

## Pages

Put a tool page in `public/_/<name>/` and serve it with `page(c, '<name>')` where appropriate. Pages use plain HTML, CSS, and ES modules; the mail app in `web-mail/` is the exception. Include `/_/ui.css`, a `<header class="bar"></header>`, and `mountBar()` from `/_/ui.js`. Reuse the shared UI tokens and controls. The Worker injects standard description, theme, Open Graph, canonical, and indexing tags; keep charset, viewport, title, stylesheet, and favicon links in the page.

Use one `<main>`, a clear heading structure, visible labels, semantic controls, accessible status and error messages, keyboard focus, and layouts that work at 400px. Escape untrusted text with `esc()` or `textContent`. The CSP disallows inline scripts and event handlers. Client-only tools should keep their processing in `public/_/<name>/`; avoid network requests for data that can stay in the browser.

Shared UI helpers include `.vh` / `.sr`, styled field sets and native controls, automatic number-input steppers, and `public/_/color/picker.js`. Give scrollable table regions a keyboard focus target and accessible name. Call `mountBar()` before setting a custom document title for a secondary page.

## Storage and checks

Bindings are defined in `wrangler.jsonc` and typed in `worker-configuration.d.ts`. Add new D1 tables in the appropriate migration directory with the next migration number and a tool-specific table prefix. Other storage includes KV, R2, and Durable Objects; follow existing tools that use the same binding.

Run `scripts/dev.sh <slot>` for an isolated local server on port `8850 + slot`, then check the tool with the provided dev bearer token and `x-host: <name>.6o2f.dev` header. Stop the server when finished. Run `pnpm check` for project checks and `node scripts/audit.mjs --slot <slot> <name>` for page, accessibility, and console checks. Inspect the page at desktop and phone widths in both color schemes; automated checks cannot judge usefulness or layout. Add focused tests for behavior with meaningful failure modes.
