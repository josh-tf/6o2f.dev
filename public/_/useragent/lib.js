// User-agent parsing with a small, ordered rule table. First match wins, so specific tokens come before generic ones
// (Edge/Opera/Samsung all also say "Chrome"; every Chromium browser also says "Safari").
const v = (re) => (ua) => re.exec(ua)?.[1]?.replace(/_/g, '.');

/** Bots and HTTP clients: [name, regex, kind, owner]. kind: search | ai | social | seo | monitor | client | automation */
const BOTS = [
  ['Googlebot', /Googlebot(?:-Image|-Video|-News)?\/([\d.]+)/i, 'search', 'Google'],
  ['Google-InspectionTool', /Google-InspectionTool\/([\d.]+)/, 'search', 'Google'],
  ['AdsBot-Google', /AdsBot-Google(?:-Mobile)?/, 'search', 'Google'],
  ['Mediapartners-Google', /Mediapartners-Google/, 'search', 'Google AdSense'],
  ['Google-Extended', /Google-Extended/, 'ai', 'Google'],
  ['Bingbot', /bingbot\/([\d.]+)/i, 'search', 'Microsoft'],
  ['DuckDuckBot', /DuckDuckBot(?:-Https)?\/([\d.]+)/, 'search', 'DuckDuckGo'],
  ['Applebot', /Applebot(?:-Extended)?\/([\d.]+)/, 'search', 'Apple'],
  ['YandexBot', /Yandex(?:Bot|Images|Mobile[A-Za-z]*)\/([\d.]+)/, 'search', 'Yandex'],
  ['Baiduspider', /Baiduspider(?:-render)?\/([\d.]+)/, 'search', 'Baidu'],
  ['Sogou', /Sogou web spider\/([\d.]+)/, 'search', 'Sogou'],
  ['SeznamBot', /SeznamBot\/([\d.]+)/, 'search', 'Seznam'],
  ['PetalBot', /PetalBot/, 'search', 'Huawei'],
  ['GPTBot', /GPTBot\/([\d.]+)/, 'ai', 'OpenAI'],
  ['ChatGPT-User', /ChatGPT-User\/([\d.]+)/, 'ai', 'OpenAI'],
  ['OAI-SearchBot', /OAI-SearchBot\/([\d.]+)/, 'ai', 'OpenAI'],
  ['ClaudeBot', /ClaudeBot\/([\d.]+)/, 'ai', 'Anthropic'],
  ['Claude-User', /Claude-User\/([\d.]+)/, 'ai', 'Anthropic'],
  ['Claude-SearchBot', /Claude-SearchBot\/([\d.]+)/, 'ai', 'Anthropic'],
  ['anthropic-ai', /anthropic-ai/, 'ai', 'Anthropic'],
  ['PerplexityBot', /PerplexityBot\/([\d.]+)/, 'ai', 'Perplexity'],
  ['Perplexity-User', /Perplexity-User\/([\d.]+)/, 'ai', 'Perplexity'],
  ['CCBot', /CCBot\/([\d.]+)/, 'ai', 'Common Crawl'],
  ['Bytespider', /Bytespider/, 'ai', 'ByteDance'],
  ['Amazonbot', /Amazonbot\/([\d.]+)/, 'ai', 'Amazon'],
  ['Meta-ExternalAgent', /meta-externalagent\/([\d.]+)/i, 'ai', 'Meta'],
  ['cohere-ai', /cohere-ai/, 'ai', 'Cohere'],
  ['facebookexternalhit', /facebookexternalhit\/([\d.]+)/, 'social', 'Meta'],
  ['Facebot', /Facebot/, 'social', 'Meta'],
  ['Twitterbot', /Twitterbot\/([\d.]+)/, 'social', 'X / Twitter'],
  ['LinkedInBot', /LinkedInBot\/([\d.]+)/, 'social', 'LinkedIn'],
  ['Slackbot', /Slackbot(?:-LinkExpanding)?(?: |\/)([\d.]+)/, 'social', 'Slack'],
  ['Discordbot', /Discordbot\/([\d.]+)/, 'social', 'Discord'],
  ['TelegramBot', /TelegramBot/, 'social', 'Telegram'],
  ['WhatsApp', /WhatsApp\/([\d.]+)/, 'social', 'Meta'],
  ['Pinterestbot', /Pinterest(?:bot)?\/([\d.]+)/, 'social', 'Pinterest'],
  ['redditbot', /redditbot\/([\d.]+)/, 'social', 'Reddit'],
  ['Embedly', /Embedly\/([\d.]+)/, 'social', 'Embedly'],
  ['AhrefsBot', /AhrefsBot\/([\d.]+)/, 'seo', 'Ahrefs'],
  ['SemrushBot', /SemrushBot(?:-[A-Za-z]+)?\/([\d.~a-z]+)/, 'seo', 'Semrush'],
  ['MJ12bot', /MJ12bot\/v?([\d.]+)/, 'seo', 'Majestic'],
  ['DotBot', /DotBot\/([\d.]+)/, 'seo', 'Moz'],
  ['Screaming Frog', /Screaming Frog SEO Spider\/([\d.]+)/, 'seo', 'Screaming Frog'],
  ['UptimeRobot', /UptimeRobot\/([\d.]+)/, 'monitor', 'UptimeRobot'],
  ['Uptime Kuma', /Uptime-Kuma\/([\d.]+)/, 'monitor', 'Uptime Kuma'],
  ['Pingdom', /Pingdom\.com_bot_version_([\d.]+)/, 'monitor', 'Pingdom'],
  ['StatusCake', /StatusCake/, 'monitor', 'StatusCake'],
  ['Better Uptime', /Better(?: |)Uptime Bot/i, 'monitor', 'Better Stack'],
  ['HeadlessChrome', /HeadlessChrome\/([\d.]+)/, 'automation', 'Chrome headless (Puppeteer, Playwright…)'],
  ['PhantomJS', /PhantomJS\/([\d.]+)/, 'automation', 'PhantomJS'],
  ['Lighthouse', /Chrome-Lighthouse/, 'automation', 'Google Lighthouse'],
  ['curl', /^curl\/([\d.]+)/, 'client', 'curl'],
  ['Wget', /^Wget\/([\d.]+)/i, 'client', 'GNU Wget'],
  ['HTTPie', /^HTTPie\/([\d.]+)/, 'client', 'HTTPie'],
  ['python-requests', /python-requests\/([\d.]+)/, 'client', 'Python requests'],
  ['python-httpx', /python-httpx\/([\d.]+)/, 'client', 'Python httpx'],
  ['aiohttp', /aiohttp\/([\d.]+)/, 'client', 'Python aiohttp'],
  ['Python-urllib', /Python-urllib\/([\d.]+)/, 'client', 'Python standard library'],
  ['Scrapy', /Scrapy\/([\d.]+)/, 'client', 'Scrapy'],
  ['Go-http-client', /Go-http-client\/([\d.]+)/, 'client', 'Go net/http'],
  ['okhttp', /okhttp\/([\d.]+)/i, 'client', 'OkHttp (Java/Android)'],
  ['Java', /^Java(?:-http-client)?\/([\d._]+)/, 'client', 'Java'],
  ['Apache-HttpClient', /Apache-HttpClient\/([\d.]+)/, 'client', 'Apache HttpClient'],
  ['axios', /axios\/([\d.]+)/, 'client', 'axios (Node.js)'],
  ['node-fetch', /node-fetch(?:\/([\d.]+))?/, 'client', 'node-fetch'],
  ['undici', /^undici|^node$/, 'client', 'Node.js fetch (undici)'],
  ['Deno', /^Deno\/([\d.]+)/, 'client', 'Deno'],
  ['Bun', /^Bun\/([\d.]+)/, 'client', 'Bun'],
  ['PostmanRuntime', /PostmanRuntime\/([\d.]+)/, 'client', 'Postman'],
  ['Insomnia', /insomnia\/([\d.]+)/, 'client', 'Insomnia'],
  ['PowerShell', /WindowsPowerShell\/([\d.]+)|PowerShell\/([\d.]+)/, 'client', 'PowerShell'],
  ['libwww-perl', /libwww-perl\/([\d.]+)/, 'client', 'Perl LWP'],
  ['Ruby', /^Ruby|Faraday v([\d.]+)/, 'client', 'Ruby'],
  ['Dart', /^Dart\/([\d.]+)/, 'client', 'Dart'],
  ['reqwest', /^reqwest/, 'client', 'Rust reqwest'],
];
const GENERIC_BOT = /bot\b|crawl|spider|slurp|scraper|fetcher|preview|monitor|checker|archiver|^Mozilla\/5\.0 \(compatible;\s*[^;)]*\+https?:/i;

/** Browsers: [name, version extractor, test?]. Order matters. */
const BROWSERS = [
  ['Edge', v(/Edg(?:e|A|iOS)?\/([\d.]+)/)],
  ['Opera Mini', v(/Opera Mini\/([\d.]+)/)],
  ['Opera', (ua) => v(/(?:OPR|OPiOS|OPT)\/([\d.]+)/)(ua) ?? (/^Opera\//.test(ua) ? (v(/Version\/([\d.]+)/)(ua) ?? v(/^Opera\/([\d.]+)/)(ua)) : undefined)],
  ['Samsung Internet', v(/SamsungBrowser\/([\d.]+)/)],
  ['Yandex Browser', v(/YaBrowser\/([\d.]+)/)],
  ['Vivaldi', v(/Vivaldi\/([\d.]+)/)],
  ['UC Browser', v(/UCBrowser\/([\d.]+)/)],
  ['Silk', v(/Silk\/([\d.]+)/)],
  ['MIUI Browser', v(/(?:XiaoMi\/)?MiuiBrowser\/([\d.]+)/)],
  ['DuckDuckGo', v(/DuckDuckGo\/([\d.]+)/)],
  ['Facebook app', v(/FBAV\/([\d.]+)/)],
  ['Instagram app', v(/Instagram ([\d.]+)/)],
  ['Electron', v(/Electron\/([\d.]+)/)],
  ['Firefox for iOS', v(/FxiOS\/([\d.]+)/)],
  ['Chrome for iOS', v(/CriOS\/([\d.]+)/)],
  ['Firefox', v(/(?:Firefox|Focus)\/([\d.]+)/)],
  ['Chrome WebView', (ua) => (/; wv\)/.test(ua) ? v(/Chrome\/([\d.]+)/)(ua) : undefined)],
  ['Headless Chrome', v(/HeadlessChrome\/([\d.]+)/)],
  ['Chrome', v(/(?:Chrome|Chromium)\/([\d.]+)/)],
  ['Internet Explorer', (ua) => v(/MSIE ([\d.]+)/)(ua) ?? (/Trident\/7/.test(ua) ? v(/rv:([\d.]+)/)(ua) : undefined)],
  // Tizen/webOS TV browsers say "Version/6.0 TV Safari": that Version is the platform's, not Safari's.
  ['Smart TV browser', (ua) => (/Tizen|Web0S|webOS/.test(ua) && /Safari\//.test(ua) ? '' : undefined)],
  [
    'Safari',
    (ua) =>
      /Safari\//.test(ua) && !/Android|Tizen|Web0S|webOS/.test(ua)
        ? (v(/Version\/([\d.]+)/)(ua) ?? (/(iPhone|iPad|Macintosh)/.test(ua) ? '' : undefined))
        : undefined,
  ],
  ['Android Browser', (ua) => (/Android/.test(ua) && /Version\/([\d.]+)/.test(ua) ? v(/Version\/([\d.]+)/)(ua) : undefined)],
];

const WINDOWS = { '10.0': '10 or 11', 6.3: '8.1', 6.2: '8', 6.1: '7', '6.0': 'Vista', 5.2: 'XP x64', 5.1: 'XP', '5.0': '2000' };
function os(ua) {
  let m;
  if ((m = /Windows Phone(?: OS)? ([\d.]+)/.exec(ua))) return { name: 'Windows Phone', version: m[1] };
  if (/Xbox/.test(ua)) return { name: 'Xbox OS', version: '' };
  if ((m = /Windows NT ([\d.]+)/.exec(ua))) return { name: 'Windows', version: WINDOWS[m[1]] ?? `NT ${m[1]}`, raw: `NT ${m[1]}` };
  if ((m = /(?:iPhone|iPod)(?:; U)?; CPU (?:iPhone )?OS ([\d_]+)/.exec(ua))) return { name: 'iOS', version: m[1].replace(/_/g, '.') };
  if ((m = /iPad.*?CPU OS ([\d_]+)/.exec(ua))) return { name: +m[1].split('_')[0] >= 13 ? 'iPadOS' : 'iOS', version: m[1].replace(/_/g, '.') };
  if ((m = /CrOS [\w]+ ([\d.]+)/.exec(ua))) return { name: 'ChromeOS', version: m[1] };
  if ((m = /HarmonyOS(?:; |\/| )([\d.]+)?/.exec(ua))) return { name: 'HarmonyOS', version: m[1] ?? '' };
  if ((m = /KAIOS\/([\d.]+)/i.exec(ua))) return { name: 'KaiOS', version: m[1] };
  if ((m = /Tizen[ /]([\d.]+)/.exec(ua))) return { name: 'Tizen', version: m[1] };
  if (/Web0S|webOS/.test(ua)) return { name: 'webOS', version: '' };
  if ((m = /PlayStation (?:\d|Vita|Portable)[^)]*?\/?([\d.]+)?\)/.exec(ua))) return { name: 'PlayStation', version: m[1] ?? '' };
  if (/Nintendo/.test(ua)) return { name: 'Nintendo', version: '' };
  if ((m = /Android[ /]?([\d.]+)?/.exec(ua))) return { name: 'Android', version: m[1] ?? '' };
  if ((m = /Mac OS X ([\d_.]+)/.exec(ua))) return { name: 'macOS', version: m[1].replace(/_/g, '.') };
  if (/Macintosh/.test(ua)) return { name: 'macOS', version: '' };
  if ((m = /(Ubuntu|Fedora|Debian|Linux Mint|Arch Linux|openSUSE|Gentoo|Red Hat|CentOS)/.exec(ua))) return { name: 'Linux', version: '', distro: m[1] };
  if ((m = /(FreeBSD|OpenBSD|NetBSD)/.exec(ua))) return { name: m[1], version: '' };
  if (/Linux|X11/.test(ua)) return { name: 'Linux', version: '' };
  return { name: '', version: '' };
}

function engine(ua, br, osName) {
  let m;
  if (osName === 'iOS' || osName === 'iPadOS') return { name: 'WebKit', version: v(/AppleWebKit\/([\d.]+)/)(ua) ?? '' };
  if ((m = /Edge\/([\d.]+)/.exec(ua))) return { name: 'EdgeHTML', version: m[1] };
  if ((m = /Trident\/([\d.]+)/.exec(ua))) return { name: 'Trident', version: m[1] };
  if ((m = /Presto\/([\d.]+)/.exec(ua))) return { name: 'Presto', version: m[1] };
  if ((m = /(?:Chrome|Chromium|HeadlessChrome)\/([\d.]+)/.exec(ua)) && +m[1].split('.')[0] >= 28) return { name: 'Blink', version: m[1] };
  if ((m = /AppleWebKit\/([\d.]+)/.exec(ua))) return { name: 'WebKit', version: m[1] };
  // Firefox froze rv: at 109.0 for 110-119; Gecko's version always equals Firefox's, so prefer that.
  if (br === 'Firefox' && (m = /Firefox\/([\d.]+)/.exec(ua))) return { name: 'Gecko', version: m[1] };
  if (/Gecko\//.test(ua) && (m = /rv:([\d.]+)/.exec(ua))) return { name: 'Gecko', version: m[1] };
  if (br === 'Firefox') return { name: 'Gecko', version: '' };
  return { name: '', version: '' };
}

const VENDORS = [
  [/iPhone|iPad|iPod|Macintosh|AppleTV/, 'Apple'],
  [/SAMSUNG|\bSM-[A-Z]\d|\bGT-[A-Z]\d|\bSCH-|Tizen/i, 'Samsung'],
  [/Pixel|Nexus|Chromecast|CrKey/, 'Google'],
  [/Redmi|POCO|\bMi \d|MIX \d|Xiaomi|\b2\d{3}[A-Z0-9]{2,6}[A-Z]{1,2}\b|\bM2\d{3}[A-Z0-9]+/i, 'Xiaomi'],
  [/HUAWEI|HONOR|\b[A-Z]{3}-(?:L|AL|TL|LX|NX)\d{2}/, 'Huawei'],
  [/ONEPLUS|OnePlus|\bCPH\d{4}|\bOPPO\b|\bPE[A-Z]{2}\d{2}/i, 'OPPO / OnePlus'],
  [/\bvivo\b|\bV2\d{3}/i, 'vivo'],
  [/moto[ rgezx]|Motorola|XT\d{4}/i, 'Motorola'],
  [/Nokia/i, 'Nokia'],
  [/\bLG[-_ ]|\bLM-[A-Z]\d|Web0S|webOS/i, 'LG'],
  [/Xperia|\bSO-\d{2}|\b[EFGH]\d{4}\b|BRAVIA|PlayStation/, 'Sony'],
  [/\bKF[A-Z]{2,4}\b|Silk\/|AFT[A-Z]/, 'Amazon'],
  [/Xbox|Windows Phone|Lumia/, 'Microsoft'],
  [/Nintendo/, 'Nintendo'],
];
function device(ua, osName, botKind) {
  if (botKind && botKind !== 'automation') return { type: botKind === 'client' ? 'client' : 'bot', vendor: '', model: '' };
  let type = 'desktop';
  if (/SMART-?TV|SmartTV|Web0S|webOS.TV|Tizen.+TV|BRAVIA|AppleTV|CrKey|Android TV|GoogleTV|AFT[A-Z]|HbbTV|\bTV Safari/i.test(ua)) type = 'tv';
  else if (/PlayStation|Xbox|Nintendo/.test(ua)) type = 'console';
  else if (/Opera Mini|Opera Mobi/.test(ua)) type = 'mobile';
  else if (/iPad|Tablet|\bKF[A-Z]{2,4}\b|Silk\//.test(ua) || (osName === 'Android' && !/Mobile/.test(ua))) type = 'tablet';
  else if (/Mobi|iPhone|iPod|Windows Phone|KAIOS/i.test(ua) || osName === 'Android') type = 'mobile';
  else if (!osName) type = '';
  const vendor = VENDORS.find(([re]) => re.test(ua))?.[1] ?? '';
  let model = '',
    m2;
  const am = /Android[^;)]*;(?: [a-z]{2}[-_][a-z]{2};)? ((?:[^;()]|\([^;()]*\))+?)(?: Build\/[^;)]+)?(?:;|\))/i.exec(ua);
  if (osName === 'Android' && am && !/^(Mobile|Tablet|wv|K|U)$/.test(am[1].trim())) model = am[1].trim();
  else if (/iPhone/.test(ua)) model = 'iPhone';
  else if (/iPad/.test(ua)) model = 'iPad';
  else if (/iPod/.test(ua)) model = 'iPod touch';
  else if (/Macintosh/.test(ua) && type === 'desktop') model = 'Mac';
  else if ((m2 = /(PlayStation [\w ]+?)(?:\/|\)|;)/.exec(ua))) model = m2[1];
  else if (/Xbox One/.test(ua)) model = 'Xbox One';
  else if (/Xbox/.test(ua)) model = 'Xbox';
  return { type, vendor, model };
}

/** Parse a UA string. */
export function parse(input) {
  const ua = String(input ?? '').trim();
  const notes = [];
  if (!ua) return { ua, empty: true, browser: {}, engine: {}, os: {}, device: {}, bot: null, notes };
  let bot = null;
  for (const [name, re, kind, owner] of BOTS) {
    const m = re.exec(ua);
    if (m) {
      bot = { name, version: m.slice(1).find(Boolean) ?? '', kind, owner };
      break;
    }
  }
  if (!bot && GENERIC_BOT.test(ua))
    bot = {
      name:
        /\(compatible;\s*([A-Za-z][^;/()+]*?)(?:\/[\w.]+)?\s*[;)]/.exec(ua)?.[1] ??
        /([A-Za-z][\w.-]*(?:bot|crawler|spider)[\w-]*)/i.exec(ua)?.[1] ??
        /^([A-Za-z][\w.-]*)/.exec(ua)?.[1] ??
        'Unknown bot',
      version: '',
      kind: 'generic',
      owner: '',
    };
  let browser = { name: '', version: '' };
  for (const [name, get] of BROWSERS) {
    const ver = get(ua);
    if (ver !== undefined) {
      browser = { name, version: ver };
      break;
    }
  }
  if (bot && bot.kind !== 'automation' && !/^Mozilla\/5\.0 \((?:Linux|iPhone|Windows|Macintosh)/.test(ua)) browser = { name: '', version: '' }; // pure bots/clients are not browsers
  const o = os(ua),
    e = browser.name || bot?.kind !== 'client' ? engine(ua, browser.name, o.name) : { name: '', version: '' };
  const d = device(ua, o.name, bot?.kind);
  if (browser.version) browser.major = browser.version.split('.')[0];
  // Notes on frozen / reduced values, so people do not over-trust them.
  if (/Chrome\/\d+\.0\.0\.0/.test(ua) && e.name === 'Blink')
    notes.push(
      'Chromium "reduced" UA: the minor version is always 0.0.0, and the OS and model are frozen. Use navigator.userAgentData.getHighEntropyValues() for real values.',
    );
  if (o.name === 'Windows' && o.raw === 'NT 10.0')
    notes.push('Windows 11 still sends "Windows NT 10.0", so the UA cannot tell 10 and 11 apart. Client hints (platformVersion 13 or higher) can.');
  if (o.name === 'macOS' && o.version === '10.15.7') notes.push('Safari and Chromium freeze macOS at 10.15.7; the real version may be much newer.');
  if (o.name === 'Android' && /Android 10; K\)/.test(ua))
    notes.push('"Android 10; K" is the frozen value from Chrome\'s reduced UA: the real Android version and device model are hidden.');
  if (o.name === 'iOS' || o.name === 'iPadOS') {
    if (browser.name && browser.name !== 'Safari') notes.push(`On ${o.name} every browser, ${browser.name} included, uses Apple's WebKit engine.`);
  }
  if (/Macintosh/.test(ua) && /Version\/1[3-9].*Safari/.test(ua) && !/Chrome|Firefox/.test(ua))
    notes.push('iPads in desktop mode (the default since iPadOS 13) send this same Mac UA. Check navigator.maxTouchPoints > 1 to tell them apart.');
  if (bot && ['search', 'ai', 'social'].includes(bot.kind))
    notes.push(`Anyone can send this UA. Real ${bot.owner} crawlers are verified by reverse DNS or published IP ranges, not by the UA string.`);
  if (browser.name === 'Chrome WebView') notes.push('The "; wv" token means an app\'s embedded WebView, not the Chrome app.');
  return { ua, browser, engine: e, os: o, device: d, bot, notes };
}

/** One-line summary, e.g. "Chrome 124 on Windows 10 or 11 (desktop)". */
export function summary(r) {
  if (r.empty) return 'Empty user agent';
  if (r.bot && !r.browser.name)
    return `${r.bot.name}${r.bot.version ? ` ${r.bot.version}` : ''} (${r.bot.kind === 'client' ? 'HTTP client' : `${r.bot.kind} bot`})`;
  const b = r.browser.name ? `${r.browser.name}${r.browser.major ? ` ${r.browser.major}` : ''}` : 'Unknown browser';
  const o = r.os.name ? ` on ${r.os.name}${r.os.version ? ` ${r.os.version}` : ''}` : '';
  return `${b}${o}${r.device.type ? ` (${r.device.type})` : ''}${r.bot && r.bot.name !== r.browser.name.replace(/ /g, '') ? `, ${r.bot.name}` : ''}`;
}

export const SAMPLES = [
  ['Chrome on Windows', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'],
  [
    'Safari on iPhone',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Mobile/15E148 Safari/604.1',
  ],
  [
    'Samsung Internet',
    'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
  ],
  ['Firefox on Linux', 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:125.0) Gecko/20100101 Firefox/125.0'],
  ['Edge on macOS', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 Edg/124.0.2478.80'],
  [
    'Googlebot',
    'Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X Build/MMB29P) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.118 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
  ],
  ['GPTBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)'],
  ['curl', 'curl/8.5.0'],
];
