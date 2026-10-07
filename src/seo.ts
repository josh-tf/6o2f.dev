// Search titles and descriptions for public tool pages, keyed by tool name.
// The page title is `${title} | 6o2f.dev`, so keep title <= 50 chars; description 110-160 chars (see seo.test.ts).
// Locked tools are noindex and need no entry.
export const SEO: Record<string, [title: string, description: string]> = {
  b64: [
    'Base64 Encode and Decode Online',
    'Encode text to Base64 or decode Base64 back to UTF-8. Accepts standard and URL-safe input, with or without padding. Free, runs in your browser.',
  ],
  aspect: [
    'Aspect Ratio Calculator: Resize, Crop, PPI',
    'Simplify sizes to aspect ratios like 16:9, resize without distortion, fit or crop to a new shape and work out screen PPI. Free and instant.',
  ],
  cidr: [
    'CIDR Subnet Calculator for IPv4 and IPv6',
    'Calculate IPv4 and IPv6 subnet ranges, netmasks, wildcards and host counts. Split, merge and test membership of CIDR blocks. Free, in-browser.',
  ],
  color: [
    'Color Converter: HEX, RGB, HSL, OKLCH',
    'Convert colors between HEX, RGB, HSL and OKLCH, check WCAG contrast ratios and build a tint and shade ramp. Free color tool, runs in your browser.',
  ],
  blob: [
    'SVG Blob Generator',
    'Generate random, reproducible SVG blob shapes. Copy the SVG or a CSS clip-path, or download SVG and PNG. Free blob maker, runs in your browser.',
  ],
  clamp: [
    'CSS clamp() Calculator for Fluid Typography',
    'Generate a CSS clamp() value that scales font size or spacing linearly between two viewport widths, in rem or px. Free fluid type calculator.',
  ],
  duration: [
    'ISO 8601 Duration Converter',
    'Convert ISO 8601 durations like P1DT2H to h:mm:ss, seconds and plain-English phrases, and back. Free duration converter, runs in your browser.',
  ],
  calendar: [
    'Printable Year Calendar with ISO Week Numbers',
    'A whole year on one page with ISO week numbers, Monday or Sunday starts and day details. Prints on a single page. Free calendar, no sign-up.',
  ],
  count: [
    'Word and Character Counter',
    'Count words, characters, sentences, paragraphs and reading time live as you type. Free word counter; your text never leaves your browser.',
  ],
  icon: [
    'Favicon Generator from Emoji or Text',
    'Make a favicon or app icon from an emoji or two letters. Download ICO, SVG and PNG sizes for browsers, iOS and Android. Free, runs in your browser.',
  ],
  html: [
    'HTML Entities Encoder and Decoder',
    'Escape text to HTML entities or unescape entities back to characters, with an option for numeric entities for non-ASCII. Free and private.',
  ],
  draw: [
    'Online Sketchpad: Draw and Export PNG',
    'Sketch with a mouse, finger or pen with pressure support, then download a PNG or copy it. Free drawing pad saved only in your browser.',
  ],
  calc: [
    'Online Calculator with History',
    'A keyboard-friendly calculator for expressions with functions, percentages and powers. Keep results in a history. Free, runs in your browser.',
  ],
  csv: [
    'CSV to JSON Converter (and JSON to CSV)',
    'Convert CSV to JSON and JSON to CSV as you type, with delimiter detection, header rows and typed numbers. Free and private: nothing is uploaded.',
  ],
  flex: [
    'CSS Flexbox Playground and Generator',
    'Try flex container and item settings on a live preview, start from presets like holy grail or nav bar, then copy the CSS and HTML. Free.',
  ],
  loan: [
    'Loan and Mortgage Repayment Calculator',
    'Work out loan or mortgage repayments, total interest and a full amortisation schedule, with extra repayments and interest-only options. Free.',
  ],
  keygen: [
    'RSA, ECDSA and Ed25519 Key Pair Generator',
    'Generate RSA, ECDSA and Ed25519 key pairs in your browser with WebCrypto. Export PEM, JWK and OpenSSH formats. Keys are never sent anywhere.',
  ],
  httpcodes: [
    'HTTP Status Codes Explained (100 to 511)',
    'Every registered HTTP status code from 100 to 511: what it means, when to send it, caching and retry hints and common mistakes. Free reference.',
  ],
  ip: [
    'What Is My IP Address? IP, Location and ASN',
    'See your public IP address, IPv4 or IPv6, city, region, country, ASN and network as seen by the Cloudflare edge. Free, no sign-in, curl-friendly.',
  ],
  grid: [
    'CSS Grid Generator with Named Areas',
    'Define grid tracks, drag across cells to place items and copy the CSS with grid-template-areas. Presets for common layouts. Free CSS grid builder.',
  ],
  percent: [
    'Percentage Calculator with Working',
    'Percent of a number, percentage change, reverse percentages and discounts, each with the working shown. Free percentage calculator.',
  ],
  css: [
    'CSS Beautifier and Minifier',
    'Beautify or minify CSS and see the size before and after gzip. Handles strings, url(), custom properties and nesting safely. Free, in-browser.',
  ],
  base: [
    'Number Base Converter: Binary, Hex, Octal',
    'Convert numbers between binary, octal, decimal, hex, base 36 and any base from 2 to 36. Exact for huge and negative integers. Free converter.',
  ],
  palette: [
    'Color Palette Generator and Image Colors',
    'Build color harmonies from a base color in OKLCH or HSL, or extract the dominant colors from an image. Free palette tool; images stay local.',
  ],
  jsonts: [
    'JSON to TypeScript, JSON Schema, Python, Go',
    'Paste sample JSON and generate TypeScript interfaces, JSON Schema, Python TypedDicts or dataclasses and Go structs. Free and private.',
  ],
  license: [
    'Open Source License Picker and Generator',
    'Choose an open-source license like MIT, Apache 2.0 or GPL with plain-English guidance, fill in year and holder, and copy the LICENSE file. Free.',
  ],
  bookmarks: [
    'Bookmark Manager with Tags',
    'Save links with tags, search them and move them between browsers with import and export. Free bookmark manager stored only in your browser.',
  ],
  shadow: [
    'CSS Box Shadow and Text Shadow Generator',
    'Build layered CSS box-shadow and text-shadow effects with a live preview and presets like soft, neon and inset. Copy the CSS. Free shadow maker.',
  ],
  screen: [
    'Screen Resolution and Browser Info Checker',
    'See your screen resolution, viewport size, pixel ratio, color scheme, input types, locale and browser features, updated live. Nothing is sent.',
  ],
  case: [
    'Text Case Converter: camelCase, snake_case',
    'Convert text to UPPERCASE, lowercase, Title Case, camelCase, snake_case, kebab-case and more at once, line by line. Free case converter.',
  ],
  qrscan: [
    'QR Code Reader from Image or Camera',
    'Scan a QR code from an image, a pasted screenshot or your camera. Decodes links, Wi-Fi and contacts. Free; images never leave your browser.',
  ],
  gradient: [
    'CSS Gradient Generator',
    'Create linear, radial and conic CSS gradients with multiple color stops and presets, then copy the CSS code. Free gradient maker.',
  ],
  mock: [
    'Mock API: Test Delays, Status Codes, Failures',
    'Build a public URL that answers with any status code, delay, body or random failure to test timeouts, retries and error handling. Free, CORS-ready.',
  ],
  lines: [
    'Sort Lines, Remove Duplicates and Filter Text',
    'Sort, dedupe, filter, number, trim and shuffle lines of text with a pipeline of steps. Fast on hundreds of thousands of lines. Free and private.',
  ],
  slug: [
    'Slug Generator: Text to URL-Safe Slugs',
    'Turn titles into clean URL slugs with accent stripping, stop-word removal, a custom separator and length limit. Free slugify tool, in-browser.',
  ],
  timer: [
    'Online Stopwatch, Countdown Timer and Pomodoro',
    'A stopwatch with laps, a countdown timer and a pomodoro timer that keep time in background tabs and across reloads. Free, no sign-up.',
  ],
  cron: [
    'Cron Expression Explainer and Next Run Times',
    'Explain a cron expression in plain English and list its next run times in your time zone or UTC. Presets for common schedules. Free.',
  ],
  totp: [
    'TOTP Code Generator (2FA Authenticator)',
    'Generate TOTP and HOTP one-time codes from a base32 secret (RFC 6238 and 4226), with SHA-1, SHA-256 or SHA-512. Free; secrets stay local.',
  ],
  escape: [
    'String Escape and Unescape for 12 Languages',
    'Escape a string for JSON, JavaScript, Python, Java, C#, Go, SQL, shell, regex and more at once, or unescape it back. Free and private.',
  ],
  jsonpath: [
    'JSONPath Online Evaluator and Tester',
    'Run JSONPath queries with filters against pasted JSON and see every match with its normalized path. Free JSONPath tester; nothing is sent.',
  ],
  curl: [
    'Convert curl to fetch, Python, Go, PHP, Node',
    'Paste a curl command, such as Copy as cURL from your browser, and get the same request as fetch, axios, Python requests, Go, PHP or Node. Free.',
  ],
  typo: [
    'Modular Type Scale Generator',
    'Build a modular type scale from a base size and ratio, optionally fluid with clamp(), and copy it as CSS, Tailwind or SCSS. Free typography tool.',
  ],
  regex: [
    'Regex Tester for JavaScript',
    'Test JavaScript regular expressions live with match highlighting, capture groups and flags. Free regex tester; nothing leaves your browser.',
  ],
  password: [
    'Strong Password and Passphrase Generator',
    "Generate strong random passwords and passphrases with your browser's cryptographic RNG, with entropy shown. Nothing is sent, logged or stored.",
  ],
  uuid: [
    'UUID Generator: v4, v7, ULID and Parser',
    'Generate UUID v4 and v7 or ULIDs in bulk, and inspect any UUID for its version, variant and timestamp. Free UUID generator, runs in your browser.',
  ],
  chmod: [
    'Chmod Calculator: Unix File Permissions',
    'Convert Unix file permissions between checkboxes, octal like 755 and symbolic like rwxr-xr-x, with setuid, setgid, sticky and umask. Free.',
  ],
  yaml: [
    'YAML to JSON Converter (and JSON to YAML)',
    'Convert YAML to JSON and JSON to YAML as you type, with indent options and clear error locations. Free converter; nothing is sent.',
  ],
  gitignore: [
    '.gitignore Generator',
    'Pick languages, frameworks, editors and operating systems to build one combined .gitignore file with duplicates removed. Free generator.',
  ],
  img: [
    'Image Converter and Resizer: WebP, PNG, JPG',
    'Convert images between WebP, PNG and JPEG, resize them and strip metadata, all in your browser. Free image converter; nothing is uploaded.',
  ],
  mime: [
    'MIME Type Lookup and File Type Checker',
    "Look up the MIME type for a file extension or the extensions for a Content-Type, and check a file's real type from its magic numbers. Free.",
  ],
  stats: [
    'Statistics Calculator: Mean, Median, Quartiles',
    'Paste numbers to get the mean, median, mode, standard deviation, quartiles, outliers and a histogram. Free descriptive statistics calculator.',
  ],
  diff: [
    'Text Diff Checker: Compare Two Texts',
    'Compare two texts side by side or unified, with line and word level differences highlighted. Free diff checker; nothing is uploaded.',
  ],
  hash: [
    'Hash Generator: MD5, SHA-1, SHA-256, HMAC',
    'Compute MD5, SHA-1, SHA-256, SHA-384, SHA-512 and HMAC hashes of text or files in hex or Base64. Free hash calculator; nothing is uploaded.',
  ],
  cert: [
    'SSL Certificate Decoder (X.509 PEM)',
    'Decode X.509 certificates and chains from PEM: subject, issuer, validity, SANs, key type, fingerprints and extensions. Free; nothing is sent.',
  ],
  date: [
    'Date Calculator: Add Days, Difference, Age',
    'Add or subtract days, weeks and months, find the difference between dates, count business days and look up ISO weeks and ages. Free.',
  ],
  send: [
    'Send Files Between Devices, Peer to Peer',
    'Send files and text directly between your devices over WebRTC, on the same network or with a pairing code. Files are not uploaded to a server.',
  ],
  hex: [
    'Hex Editor and Hex Dump Viewer Online',
    'View a hex dump of text or a file, convert between text, hex, binary and decimal bytes, search bytes and inspect values. Free and private.',
  ],
  jwtgen: [
    'JWT Generator: Sign HS256, RS256, ES256',
    'Build and sign a JSON Web Token with HS256/384/512, RS256 or ES256, then verify it. Free JWT signer; keys and secrets never leave your browser.',
  ],
  tip: [
    'Tip Calculator and Bill Splitter',
    'Work out the tip and split the bill between people, to the cent, with tax options and any currency. Free tip calculator, runs in your browser.',
  ],
  morse: [
    'Morse Code Translator with Audio',
    'Translate text to Morse code and back, play it as sound or light, download a WAV and tap your own Morse. Free Morse code translator.',
  ],
  jwt: [
    'JWT Decoder: Decode JSON Web Tokens',
    'Decode a JWT to read its header, payload and claims with readable dates, and verify HS256 signatures. Free; the token never leaves your browser.',
  ],
  units: [
    'Unit Converter: Length, Weight, Temperature',
    'Convert length, weight, temperature, volume, area, speed, data size and more. Type in any field and the rest update. Free unit converter.',
  ],
  lorem: [
    'Lorem Ipsum Generator',
    'Generate lorem ipsum placeholder paragraphs, sentences or words. The same seed gives the same text every time. Free, runs in your browser.',
  ],
  kanban: [
    'Free Kanban Board in Your Browser',
    'Kanban boards with columns, cards, labels and due dates. Drag and drop or use the keyboard. Saved only in your browser; no account needed.',
  ],
  qr: [
    'QR Code Generator: PNG and SVG',
    'Make QR codes for links, Wi-Fi networks, email and phone numbers. Set error correction, colors and size, then download PNG or SVG. Free.',
  ],
  todo: [
    'Simple To-Do List in Your Browser',
    'A fast checklist that lives only in your browser, with keyboard shortcuts, reordering and export. No account and nothing sent anywhere.',
  ],
  random: [
    'Random Number Generator, Dice and Coin Flip',
    "Roll dice, flip coins, pick random numbers, shuffle lists and make random colors with your browser's cryptographic RNG. Free and private.",
  ],
  json: [
    'JSON Formatter and Validator',
    'Format, beautify, minify and validate JSON with clear error locations and sorted keys. Free JSON formatter; your data never leaves your browser.',
  ],
  notes: [
    'Private Online Notepad (Works Offline)',
    'A private scratchpad that saves notes in your browser and works offline, with search and export. Nothing is sent anywhere; no sign-up.',
  ],
  sql: [
    'SQL Formatter and Minifier',
    'Format or minify SQL queries for PostgreSQL, MySQL and SQLite. Keyword case, indentation and comma style options; literals untouched. Free.',
  ],
  rot: [
    'ROT13, Caesar and Vigenère Cipher Tool',
    'Encode and decode ROT13, ROT47, Caesar, Atbash, Vigenère, rail fence and affine ciphers, keeping case and punctuation. Free cipher tool.',
  ],
  table: [
    'Markdown Table Generator and Converter',
    'Paste CSV, TSV, Markdown, HTML or JSON, edit it as a grid, and copy it as an aligned Markdown table, HTML, ASCII table or CSV. Free.',
  ],
  unicode: [
    'Unicode Character Inspector',
    'Inspect every character in a string: code points, names, UTF-8 and UTF-16 bytes, invisible characters and normalization. Free Unicode lookup.',
  ],
  xml: [
    'XML Formatter, Validator and XML to JSON',
    'Format, minify and validate XML with error locations, and convert XML to JSON or JSON to XML. Free XML tool; nothing leaves your browser.',
  ],
  tz: [
    'Time Zone Converter and Meeting Planner',
    'Compare times across world time zones, see working hours overlap and plan a meeting time. Free world clock and time zone converter.',
  ],
  svg: [
    'SVG Optimizer, Viewer and Data URI Converter',
    'Preview SVG safely, strip scripts and editor metadata, shrink the file and convert it to a data URI or CSS background. Free SVG tool.',
  ],
  useragent: [
    'User Agent Parser: Browser, OS, Device, Bot',
    'Parse any User-Agent string into browser, engine, operating system, device type and bot, and see what your own browser reports. Free.',
  ],
  url: [
    'URL Encoder, Decoder and Parser',
    'Percent-encode and decode URLs and query strings, and break a URL into protocol, host, path and parameters. Free URL encoder, in-browser.',
  ],
  md: [
    'Markdown Editor with Live Preview',
    'Write Markdown with a live preview, task lists and tables, then copy as HTML or Markdown. Raw HTML is escaped. Free online Markdown editor.',
  ],
  roman: [
    'Roman Numeral Converter and Number to Words',
    'Convert numbers to Roman numerals and back, and write numbers as English words: cardinal, ordinal and cheque wording. Free converter.',
  ],
  tree: [
    'Folder Tree Generator from Paths',
    'Turn a list of file paths, find or ls -R output into an ASCII folder tree, or a drawn tree back into paths. Free directory tree generator.',
  ],
  keycode: [
    'JavaScript Key Codes: event.key, code, keyCode',
    'Press any key to see its JavaScript event.key, event.code, legacy keyCode and which, location and modifiers, with copy-ready code. Free keycode tool.',
  ],
  time: [
    'Unix Timestamp Converter (Epoch to Date)',
    'Convert Unix epoch timestamps in seconds, milliseconds, microseconds or nanoseconds to dates and ISO 8601, and back. Free epoch converter.',
  ],
};
