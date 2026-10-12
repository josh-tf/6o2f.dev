// CSP for every HTML page. Keep it identical to the /_/* one in public/_headers (static files skip the Worker).
export const HTML_CSP =
  "default-src 'self'; script-src 'self' 'sha256-YynjG5lDd9Ulbw7xL2D8gfwkg3qBmx2fWH1xigAR1nM=' https://static.cloudflareinsights.com; connect-src 'self' wss://*.6o2f.dev https://cloudflareinsights.com; img-src 'self' data: https://cdn.discordapp.com; font-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://discord.com";
