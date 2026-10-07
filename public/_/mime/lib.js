// MIME type table (IANA registry + the de-facto types browsers and servers use) and magic-number sniffing.
// Each line: "<type> <ext> <ext>…". The first type listed for an extension is its preferred type.
const RAW = {
  Web: `text/html html htm shtml xht
text/css css
text/javascript js mjs cjs
application/json json map
application/ld+json jsonld
application/manifest+json webmanifest
application/xhtml+xml xhtml
application/xml xml xsl xsd
text/xml
application/rss+xml rss
application/atom+xml atom
application/wasm wasm
application/x-www-form-urlencoded
multipart/form-data
text/event-stream
application/javascript
application/problem+json
application/graphql graphql gql
application/sql sql
application/x-httpd-php php
text/vtt vtt
application/x-shockwave-flash swf
application/opensearchdescription+xml osdx
application/x-web-app-manifest+json webapp
text/cache-manifest appcache manifest
application/n-triples nt
text/turtle ttl
application/sparql-query rq
application/vnd.api+json
application/hal+json
application/xslt+xml xslt
application/soap+xml
application/geo+json geojson
application/vnd.google-earth.kml+xml kml
application/vnd.google-earth.kmz kmz
application/gpx+xml gpx`,
  Images: `image/png png
image/jpeg jpg jpeg jpe jfif pjpeg pjp
image/gif gif
image/webp webp
image/avif avif
image/svg+xml svg svgz
image/x-icon ico cur
image/vnd.microsoft.icon
image/bmp bmp dib
image/tiff tif tiff
image/heic heic
image/heif heif
image/heic-sequence heics
image/heif-sequence heifs
image/jxl jxl
image/jp2 jp2 j2k jpf jpx jpm
image/apng apng
image/vnd.adobe.photoshop psd
image/x-portable-pixmap ppm
image/x-portable-graymap pgm
image/x-portable-bitmap pbm
image/x-portable-anymap pnm
image/x-xbitmap xbm
image/x-xpixmap xpm
image/x-tga tga
image/x-pcx pcx
image/vnd.dxf dxf
image/vnd.dwg dwg
image/x-canon-cr2 cr2
image/x-canon-cr3 cr3
image/x-nikon-nef nef
image/x-sony-arw arw
image/x-adobe-dng dng
image/x-panasonic-rw2 rw2
image/x-olympus-orf orf
image/x-fuji-raf raf
image/x-exr exr
image/vnd.radiance hdr
image/x-xcf xcf
image/ktx2 ktx2
image/ktx ktx
image/vnd.ms-dds dds
image/x-emf emf
image/x-wmf wmf
image/x-icns icns`,
  Audio: `audio/mpeg mp3 mpga mp2 m2a
audio/mp4 m4a m4b m4p
audio/aac aac
audio/ogg ogg oga opus spx
audio/opus
audio/wav wav
audio/x-wav
audio/webm weba
audio/flac flac
audio/x-flac
audio/x-aiff aif aiff aifc
audio/midi mid midi kar
audio/x-ms-wma wma
audio/amr amr
audio/3gpp
audio/x-matroska mka
audio/x-caf caf
audio/basic au snd
audio/x-ape ape
audio/x-mpegurl m3u
audio/x-scpls pls
audio/ac3 ac3
audio/vnd.dts dts
audio/x-mod mod
audio/x-xm xm
audio/x-it it
audio/x-s3m s3m
audio/x-wavpack wv
audio/x-tta tta
audio/x-voc voc
audio/x-musepack mpc
audio/vnd.wave`,
  Video: `video/mp4 mp4 m4v mp4v mpg4
video/webm webm
video/ogg ogv
video/quicktime mov qt
video/x-matroska mkv mk3d
video/x-msvideo avi
video/mpeg mpeg mpg mpe m1v m2v
video/mp2t ts m2ts mts
video/3gpp 3gp 3gpp
video/3gpp2 3g2
video/x-flv flv
video/x-ms-wmv wmv
video/x-ms-asf asf asx
video/x-m4v
video/h264 h264
video/h265 h265
video/av1
application/vnd.apple.mpegurl m3u8
application/x-mpegurl
application/dash+xml mpd
video/x-ms-vob vob
video/x-f4v f4v
video/x-mng mng
video/vnd.dlna.mpeg-tts tts
application/vnd.rn-realmedia rm rmvb`,
  Fonts: `font/woff woff
font/woff2 woff2
font/ttf ttf
font/otf otf
font/collection ttc otc
application/vnd.ms-fontobject eot
application/font-woff
application/x-font-ttf
application/x-font-otf
application/x-font-bdf bdf
application/x-font-pcf pcf
application/x-font-type1 pfa pfb pfm afm
font/sfnt`,
  Documents: `application/pdf pdf
application/msword doc dot
application/vnd.openxmlformats-officedocument.wordprocessingml.document docx
application/vnd.openxmlformats-officedocument.wordprocessingml.template dotx
application/vnd.ms-word.document.macroEnabled.12 docm
application/vnd.ms-excel xls xlt xla
application/vnd.openxmlformats-officedocument.spreadsheetml.sheet xlsx
application/vnd.openxmlformats-officedocument.spreadsheetml.template xltx
application/vnd.ms-excel.sheet.macroEnabled.12 xlsm
application/vnd.ms-excel.sheet.binary.macroEnabled.12 xlsb
application/vnd.ms-powerpoint ppt pps pot
application/vnd.openxmlformats-officedocument.presentationml.presentation pptx
application/vnd.openxmlformats-officedocument.presentationml.slideshow ppsx
application/vnd.openxmlformats-officedocument.presentationml.template potx
application/vnd.ms-powerpoint.presentation.macroEnabled.12 pptm
application/vnd.oasis.opendocument.text odt
application/vnd.oasis.opendocument.spreadsheet ods
application/vnd.oasis.opendocument.presentation odp
application/vnd.oasis.opendocument.graphics odg
application/vnd.oasis.opendocument.formula odf
application/vnd.oasis.opendocument.text-template ott
application/rtf rtf
text/rtf
application/epub+zip epub
application/x-mobipocket-ebook mobi prc
application/vnd.amazon.ebook azw
application/x-fictionbook+xml fb2
application/vnd.ms-xpsdocument xps
application/oxps oxps
application/vnd.apple.pages pages
application/vnd.apple.numbers numbers
application/vnd.apple.keynote key
application/vnd.visio vsd
application/vnd.ms-visio.drawing vsdx
application/vnd.ms-project mpp
application/vnd.ms-outlook msg
message/rfc822 eml mime
application/postscript ps eps ai
application/x-latex latex
application/x-tex tex
application/x-texinfo texi texinfo
application/x-dvi dvi
application/vnd.ms-htmlhelp chm
application/x-abiword abw
application/vnd.sun.xml.writer sxw
application/x-iwork-keynote-sffkey
application/onenote one
application/x-mspublisher pub
image/vnd.djvu djvu djv
application/x-cbz cbz
application/x-cbr cbr
application/vnd.comicbook+zip
application/vnd.comicbook-rar
text/calendar ics ifb
text/vcard vcf vcard
text/x-vcard`,
  Archives: `application/zip zip
application/gzip gz tgz
application/x-gzip
application/x-tar tar
application/x-bzip2 bz2 tbz2
application/x-bzip bz
application/x-xz xz txz
application/zstd zst
application/x-7z-compressed 7z
application/vnd.rar rar
application/x-rar-compressed
application/x-lzip lz
application/x-lzma lzma
application/x-lz4 lz4
application/x-compress Z
application/x-arj arj
application/x-cpio cpio
application/x-ace-compressed ace
application/x-stuffit sit
application/x-apple-diskimage dmg
application/x-iso9660-image iso
application/vnd.debian.binary-package deb
application/x-rpm rpm
application/x-redhat-package-manager
application/vnd.android.package-archive apk
application/vnd.android.aab aab
application/java-archive jar war ear
application/x-xpinstall xpi
application/x-chrome-extension crx
application/vnd.ms-cab-compressed cab
application/x-msi msi
application/x-msdownload exe dll com
application/vnd.microsoft.portable-executable
application/x-executable
application/x-elf
application/x-sharedlib so
application/x-mach-binary dylib
application/x-sh sh
application/x-csh csh
application/vnd.appimage appimage
application/x-snap snap
application/x-flatpak flatpak
application/x-ms-application application
application/octet-stream bin dat img dump`,
  Code: `text/plain txt text log conf cfg ini
text/markdown md markdown mdx
text/csv csv
text/tab-separated-values tsv tab
text/x-python py pyw pyi
text/x-c c h
text/x-c++ cpp cc cxx hpp hh hxx c++ h++
text/x-csharp cs
text/x-java java
text/x-kotlin kt kts
text/x-scala scala sc
text/x-go go
text/x-rust rs
text/x-swift swift
text/x-objective-c m mm
text/x-ruby rb rbw gemspec
text/x-perl pl pm
text/x-lua lua
text/x-r r
text/x-julia jl
text/x-haskell hs lhs
text/x-erlang erl hrl
text/x-elixir ex exs
text/x-clojure clj cljs cljc edn
text/x-dart dart
text/x-fortran f f90 f95 for
text/x-pascal pas pp
text/x-asm asm s
text/x-zig zig
text/x-nim nim
text/x-ocaml ml mli
text/x-fsharp fs fsi fsx
text/x-vb vb vbs
text/x-groovy groovy gradle
text/x-shellscript bash zsh fish ksh
text/x-powershell ps1 psm1 psd1
text/x-batch bat cmd
application/typescript ts tsx mts cts
text/x-typescript
text/jsx jsx
text/x-vue vue
text/x-svelte svelte
text/x-astro astro
text/x-scss scss
text/x-sass sass
text/x-less less
text/x-stylus styl
text/x-handlebars-template hbs handlebars
text/x-pug pug jade
text/x-diff diff patch
text/x-makefile mk
text/x-cmake cmake
text/x-dockerfile dockerfile
text/x-nix nix
text/x-terraform tf tfvars
text/x-hcl hcl
text/x-protobuf proto
text/x-thrift thrift
text/x-sql psql
text/x-tcl tcl
text/x-d d
text/x-crystal cr
text/x-solidity sol
text/x-sas sas
text/x-matlab
text/x-rst rst
text/x-org org
text/asciidoc adoc asciidoc
text/x-tex
application/x-ipynb+json ipynb
application/x-httpd-php-source phps
application/x-perl
application/x-python-code pyc pyo
application/java-vm class
application/x-java-jnlp-file jnlp
text/x-java-properties properties
text/x-gitignore gitignore
text/x-editorconfig editorconfig
text/x-env env`,
  Data: `application/yaml yaml yml
text/yaml
application/toml toml
application/x-ndjson ndjson jsonl
application/json5 json5
application/x-msgpack msgpack
application/cbor cbor
application/vnd.apache.parquet parquet
application/vnd.apache.avro avro
application/vnd.apache.arrow.file arrow feather
application/x-hdf5 h5 hdf5
application/x-netcdf nc
application/vnd.sqlite3 sqlite sqlite3 db db3
application/x-sqlite3
application/x-protobuf pb
application/vnd.ms-access mdb accdb
application/x-dbf dbf
application/vnd.lotus-1-2-3 123
application/x-pkcs12 p12 pfx
application/x-x509-ca-cert crt der cer
application/pkix-cert
application/x-pem-file pem
application/pkcs8 p8 key
application/pkcs10 p10 csr
application/pkcs7-mime p7m p7c
application/pkcs7-signature p7s
application/pgp-signature sig asc
application/pgp-encrypted pgp gpg
application/pgp-keys
application/x-bittorrent torrent
application/vnd.ms-pki.stl stl
model/stl
model/gltf+json gltf
model/gltf-binary glb
model/obj obj
model/vnd.usdz+zip usdz
model/3mf 3mf
model/vrml wrl
model/step step stp
model/iges igs iges
application/vnd.ms-pki.seccat cat
application/x-blender blend
application/x-subrip srt
text/x-ssa ssa ass
application/ttml+xml ttml
application/x-lisp lisp
application/x-ole-storage
application/vnd.tcpdump.pcap pcap cap
application/x-pcapng pcapng
application/x-virtualbox-vdi vdi
application/x-vmdk vmdk
application/x-qemu-disk qcow2
application/x-ova ova`,
};

/** [{ type, exts, cat }] */
export const TABLE = Object.entries(RAW).flatMap(([cat, block]) =>
  block.split('\n').map((l) => {
    const [type, ...exts] = l.trim().split(/\s+/);
    return { type, exts, cat };
  }),
);
export const CATS = Object.keys(RAW);
const EXT = new Map(),
  TYPE = new Map();
for (const r of TABLE) {
  if (!TYPE.has(r.type)) TYPE.set(r.type, r);
  for (const e of r.exts) {
    const k = e.toLowerCase();
    if (!EXT.has(k)) EXT.set(k, []);
    EXT.get(k).push(r.type);
  }
}
// Aliases: non-preferred spellings point at the canonical type for display.
export const ALIASES = {
  'application/javascript': 'text/javascript',
  'application/x-javascript': 'text/javascript',
  'text/xml': 'application/xml',
  'audio/x-wav': 'audio/wav',
  'audio/vnd.wave': 'audio/wav',
  'audio/x-flac': 'audio/flac',
  'application/x-gzip': 'application/gzip',
  'application/x-rar-compressed': 'application/vnd.rar',
  'image/vnd.microsoft.icon': 'image/x-icon',
  'application/font-woff': 'font/woff',
  'application/x-font-ttf': 'font/ttf',
  'application/x-font-otf': 'font/otf',
  'text/yaml': 'application/yaml',
  'application/x-sqlite3': 'application/vnd.sqlite3',
  'text/rtf': 'application/rtf',
  'text/x-vcard': 'text/vcard',
  'application/x-mpegurl': 'application/vnd.apple.mpegurl',
  'text/x-typescript': 'application/typescript',
  'application/x-redhat-package-manager': 'application/x-rpm',
  'audio/opus': 'audio/ogg',
  'video/x-m4v': 'video/mp4',
  'application/pkix-cert': 'application/x-x509-ca-cert',
  'model/stl': 'application/vnd.ms-pki.stl',
  'application/vnd.microsoft.portable-executable': 'application/x-msdownload',
};

/** Extension from "x.tar.gz", ".PNG", "png", "photo.JPG", "/a/b/c.d/e" → lowercase without dot; "" when none. */
export function extOf(name, bare = true) {
  // bare: a lone word like "png" is the extension itself (lookup box); for real file names "ls" has none.
  const base = String(name ?? '')
    .trim()
    .split(/[\\/]/)
    .pop()
    .toLowerCase();
  if (!base) return '';
  if (bare && /^\.?[a-z0-9+_-]+$/i.test(base) && !base.slice(1).includes('.')) return base.replace(/^\./, ''); // bare "png" or ".png"
  const i = base.lastIndexOf('.');
  return i > 0 ? base.slice(i + 1) : '';
}

/** Types for an extension, preferred first. */
export const typesForExt = (ext) => EXT.get(String(ext).toLowerCase().replace(/^\./, '')) ?? [];

/** Entry for a type, following aliases and ignoring parameters (; charset=…). Returns { type, exts, cat, alias? } or null. */
export function lookupType(t) {
  const clean = String(t ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!clean) return null;
  const canon = ALIASES[clean] ?? clean;
  const row = TYPE.get(canon) ?? [...TYPE.values()].find((r) => r.type.toLowerCase() === canon);
  if (!row) return null;
  return {
    ...row,
    exts: row.exts.length ? row.exts : (TABLE.find((r) => r.type === canon && r.exts.length)?.exts ?? []),
    alias: canon !== clean ? clean : undefined,
  };
}

/** Is the type textual (so a Content-Type should carry a charset)? */
export const isText = (t) =>
  /^text\//.test(t) ||
  /[+/](json|xml|javascript|yaml|toml|ecmascript|graphql|sql)(;|$)/.test(t) ||
  t === 'application/x-ndjson' ||
  t === 'image/svg+xml' ||
  t === 'application/typescript';
export const header = (t) => `Content-Type: ${t}${isText(t) ? '; charset=utf-8' : ''}`;

/** Free-text search across type and extension. Returns rows sorted with exact hits first. */
export function search(q, cat = '') {
  const s = String(q ?? '')
    .trim()
    .toLowerCase()
    .replace(/^\*?\./, '');
  const rows = TABLE.filter((r) => !cat || r.cat === cat);
  if (!s) return rows;
  const score = (r) =>
    r.exts.includes(s)
      ? 0
      : r.type === s
        ? 0
        : r.exts.some((e) => e.startsWith(s))
          ? 1
          : r.type.split('/')[1]?.startsWith(s)
            ? 2
            : r.type.includes(s) || r.exts.some((e) => e.includes(s))
              ? 3
              : 9;
  return rows
    .map((r) => [score(r), r])
    .filter(([n]) => n < 9)
    .sort((a, b) => a[0] - b[0])
    .map(([, r]) => r);
}

/* ---------- Magic numbers ---------- */
const at = (b, off, sig) => sig.every((v, i) => v === null || b[off + i] === v);
const ascii = (b, off, s) =>
  at(
    b,
    off,
    [...s].map((ch) => ch.charCodeAt(0)),
  );
const str = (b, off, n) => String.fromCharCode(...b.slice(off, off + n));
const ZIPX = [
  'zip',
  'docx',
  'xlsx',
  'pptx',
  'docm',
  'xlsm',
  'pptm',
  'dotx',
  'xltx',
  'potx',
  'ppsx',
  'odt',
  'ods',
  'odp',
  'odg',
  'ott',
  'epub',
  'jar',
  'war',
  'ear',
  'apk',
  'aab',
  'xpi',
  'cbz',
  'kmz',
  'usdz',
  '3mf',
  'ipa',
  'vsdx',
  'xps',
  'oxps',
  'sketch',
  'whl',
  'nupkg',
  'pages',
  'numbers',
  'key',
  'ora',
  'crx',
];
const FTYP = {
  avif: ['image/avif', 'AVIF image', ['avif']],
  avis: ['image/avif', 'AVIF image sequence', ['avif']],
  heic: ['image/heic', 'HEIC image', ['heic', 'heif']],
  heix: ['image/heic', 'HEIC image', ['heic', 'heif']],
  mif1: ['image/heif', 'HEIF image', ['heif', 'heic']],
  msf1: ['image/heif-sequence', 'HEIF sequence', ['heifs', 'heif']],
  'qt  ': ['video/quicktime', 'QuickTime movie', ['mov', 'qt']],
  'M4A ': ['audio/mp4', 'MPEG-4 audio', ['m4a', 'm4b', 'mp4']],
  'M4B ': ['audio/mp4', 'MPEG-4 audiobook', ['m4b', 'm4a']],
  'M4V ': ['video/mp4', 'MPEG-4 video (iTunes)', ['m4v', 'mp4']],
  '3gp4': ['video/3gpp', '3GPP video', ['3gp', '3gpp']],
  '3gp5': ['video/3gpp', '3GPP video', ['3gp', '3gpp']],
  '3g2a': ['video/3gpp2', '3GPP2 video', ['3g2']],
  crx: ['image/x-canon-cr3', 'Canon CR3 raw', ['cr3']],
};
/** Ordered signature checks. Each returns [type, label, compatible extensions] or undefined. */
const SIGS = [
  (b) => at(b, 0, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) && ['image/png', 'PNG image', ['png', 'apng']],
  (b) => at(b, 0, [0xff, 0xd8, 0xff]) && ['image/jpeg', 'JPEG image', ['jpg', 'jpeg', 'jpe', 'jfif', 'pjpeg', 'pjp']],
  (b) => (ascii(b, 0, 'GIF87a') || ascii(b, 0, 'GIF89a')) && ['image/gif', 'GIF image', ['gif']],
  (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WEBP') && ['image/webp', 'WebP image', ['webp']],
  (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'WAVE') && ['audio/wav', 'WAV audio', ['wav']],
  (b) => ascii(b, 0, 'RIFF') && ascii(b, 8, 'AVI ') && ['video/x-msvideo', 'AVI video', ['avi']],
  (b) => ascii(b, 0, '%PDF-') && ['application/pdf', 'PDF document', ['pdf', 'ai']],
  (b) => (at(b, 0, [0x50, 0x4b, 0x03, 0x04]) || at(b, 0, [0x50, 0x4b, 0x05, 0x06]) || at(b, 0, [0x50, 0x4b, 0x07, 0x08])) && zipKind(b),
  (b) => at(b, 0, [0x1f, 0x8b]) && ['application/gzip', 'gzip compressed', ['gz', 'tgz', 'svgz']],
  (b) => ascii(b, 0, 'BZh') && b[3] >= 0x31 && b[3] <= 0x39 && ['application/x-bzip2', 'bzip2 compressed', ['bz2', 'tbz2', 'tbz']],
  (b) => at(b, 0, [0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00]) && ['application/x-xz', 'xz compressed', ['xz', 'txz']],
  (b) => at(b, 0, [0x28, 0xb5, 0x2f, 0xfd]) && ['application/zstd', 'Zstandard compressed', ['zst', 'zstd']],
  (b) => at(b, 0, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]) && ['application/x-7z-compressed', '7-Zip archive', ['7z']],
  (b) => at(b, 0, [0x52, 0x61, 0x72, 0x21, 0x1a, 0x07]) && ['application/vnd.rar', 'RAR archive', ['rar', 'cbr']],
  (b) => ascii(b, 257, 'ustar') && ['application/x-tar', 'tar archive', ['tar']],
  (b) => ascii(b, 4, 'ftyp') && ftypKind(b),
  (b) =>
    at(b, 0, [0x1a, 0x45, 0xdf, 0xa3]) &&
    (str(b, 0, 64).includes('webm') ? ['video/webm', 'WebM video', ['webm', 'weba']] : ['video/x-matroska', 'Matroska video', ['mkv', 'mka', 'mk3d', 'webm']]),
  (b) => ascii(b, 0, 'ID3') && ['audio/mpeg', 'MP3 audio (ID3 tag)', ['mp3', 'mpga']],
  (b) =>
    b[0] === 0xff &&
    (b[1] & 0xe0) === 0xe0 &&
    ((b[1] >> 1) & 3) !== 0 &&
    ((b[1] >> 3) & 3) !== 1 && ['audio/mpeg', 'MPEG audio (no ID3 tag)', ['mp3', 'mp2', 'mpga']],
  (b) => b[0] === 0xff && (b[1] & 0xf6) === 0xf0 && ['audio/aac', 'AAC audio (ADTS)', ['aac']],
  (b) =>
    ascii(b, 0, 'OggS') &&
    (ascii(b, 28, 'OpusHead')
      ? ['audio/ogg', 'Ogg Opus audio', ['opus', 'ogg', 'oga']]
      : ascii(b, 29, 'theora')
        ? ['video/ogg', 'Ogg Theora video', ['ogv', 'ogg']]
        : ['audio/ogg', 'Ogg audio', ['ogg', 'oga', 'ogv', 'spx', 'opus']]),
  (b) => ascii(b, 0, 'fLaC') && ['audio/flac', 'FLAC audio', ['flac']],
  (b) => ascii(b, 0, 'FORM') && (ascii(b, 8, 'AIFF') || ascii(b, 8, 'AIFC')) && ['audio/x-aiff', 'AIFF audio', ['aif', 'aiff', 'aifc']],
  (b) => ascii(b, 0, 'MThd') && ['audio/midi', 'MIDI', ['mid', 'midi', 'kar']],
  (b) => ascii(b, 0, 'wOFF') && ['font/woff', 'WOFF font', ['woff']],
  (b) => ascii(b, 0, 'wOF2') && ['font/woff2', 'WOFF2 font', ['woff2']],
  (b) => at(b, 0, [0x00, 0x01, 0x00, 0x00, 0x00]) && ['font/ttf', 'TrueType font', ['ttf']],
  (b) => ascii(b, 0, 'OTTO') && ['font/otf', 'OpenType font (CFF)', ['otf']],
  (b) => ascii(b, 0, 'ttcf') && ['font/collection', 'Font collection', ['ttc', 'otc']],
  (b) => ascii(b, 0, 'SQLite format 3\0') && ['application/vnd.sqlite3', 'SQLite 3 database', ['sqlite', 'sqlite3', 'db', 'db3']],
  (b) => ascii(b, 0, 'MZ') && ['application/x-msdownload', 'Windows executable (PE/MZ)', ['exe', 'dll', 'com', 'sys', 'scr', 'ocx', 'cpl', 'efi', 'msi']],
  (b) =>
    at(b, 0, [0x7f, 0x45, 0x4c, 0x46]) && [
      'application/x-elf',
      `ELF ${b[4] === 2 ? '64' : '32'}-bit ${b[16] === 3 ? 'shared object / PIE' : b[16] === 2 ? 'executable' : b[16] === 1 ? 'relocatable object' : b[16] === 4 ? 'core dump' : 'binary'}`,
      ['', 'so', 'o', 'elf', 'bin', 'out', 'ko', 'axf', 'appimage'],
    ],
  (b) =>
    (at(b, 0, [0xcf, 0xfa, 0xed, 0xfe]) || at(b, 0, [0xce, 0xfa, 0xed, 0xfe]) || at(b, 0, [0xfe, 0xed, 0xfa, 0xcf])) && [
      'application/x-mach-binary',
      'Mach-O binary',
      ['', 'dylib', 'bundle', 'o'],
    ],
  (b) =>
    at(b, 0, [0xca, 0xfe, 0xba, 0xbe]) &&
    (b[7] > 0 && b[7] < 40 && b[4] === 0 && b[5] === 0
      ? ['application/x-mach-binary', 'Mach-O universal binary', ['', 'dylib']]
      : ['application/java-vm', 'Java class file', ['class']]),
  (b) => at(b, 0, [0x00, 0x61, 0x73, 0x6d]) && ['application/wasm', 'WebAssembly module', ['wasm']],
  (b) => at(b, 0, [0x00, 0x00, 0x01, 0x00]) && b[4] > 0 && ['image/x-icon', 'Windows icon', ['ico']],
  (b) => at(b, 0, [0x00, 0x00, 0x02, 0x00]) && b[4] > 0 && ['image/x-icon', 'Windows cursor', ['cur', 'ico']],
  (b) => ascii(b, 0, 'icns') && ['image/x-icns', 'macOS icon', ['icns']],
  (b) => ascii(b, 0, 'BM') && b.length > 26 && at(b, 6, [0, 0, 0, 0]) && ['image/bmp', 'BMP image', ['bmp', 'dib']],
  (b) =>
    (at(b, 0, [0x49, 0x49, 0x2a, 0x00]) || at(b, 0, [0x4d, 0x4d, 0x00, 0x2a])) && [
      'image/tiff',
      'TIFF image (or camera raw)',
      ['tif', 'tiff', 'dng', 'cr2', 'nef', 'arw', 'orf', 'rw2', 'pef', 'srw'],
    ],
  (b) => ascii(b, 0, '8BPS') && ['image/vnd.adobe.photoshop', 'Photoshop document', ['psd', 'psb']],
  (b) => (at(b, 0, [0xff, 0x0a]) || at(b, 0, [0, 0, 0, 0x0c, 0x4a, 0x58, 0x4c, 0x20])) && ['image/jxl', 'JPEG XL image', ['jxl']],
  (b) => at(b, 0, [0, 0, 0, 0x0c, 0x6a, 0x50, 0x20, 0x20]) && ['image/jp2', 'JPEG 2000 image', ['jp2', 'j2k', 'jpf', 'jpx']],
  (b) => ascii(b, 0, '%!PS') && ['application/postscript', 'PostScript', ['ps', 'eps', 'ai']],
  (b) => ascii(b, 0, '{\\rtf') && ['application/rtf', 'Rich Text Format', ['rtf']],
  (b) =>
    at(b, 0, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) && [
      'application/x-ole-storage',
      'Microsoft compound file (legacy Office, MSI, MSG)',
      ['doc', 'xls', 'ppt', 'msi', 'msg', 'dot', 'xlt', 'pot', 'pps', 'vsd', 'mpp', 'pub'],
    ],
  (b) => ascii(b, 0, 'MSCF') && ['application/vnd.ms-cab-compressed', 'Cabinet archive', ['cab']],
  (b) => ascii(b, 0, '!<arch>\ndebian') && ['application/vnd.debian.binary-package', 'Debian package', ['deb']],
  (b) => at(b, 0, [0xed, 0xab, 0xee, 0xdb]) && ['application/x-rpm', 'RPM package', ['rpm']],
  (b) => ascii(b, 0, 'koly') && ['application/x-apple-diskimage', 'Apple disk image', ['dmg']],
  (b) => ascii(b, 0x8001, 'CD001') && ['application/x-iso9660-image', 'ISO 9660 disc image', ['iso']],
  (b) => ascii(b, 0, 'FLV') && b[3] === 1 && ['video/x-flv', 'Flash video', ['flv']],
  (b) => at(b, 0, [0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11]) && ['video/x-ms-asf', 'Windows Media (ASF)', ['wmv', 'wma', 'asf']],
  (b) => at(b, 0, [0, 0, 1, 0xba]) && ['video/mpeg', 'MPEG program stream', ['mpg', 'mpeg', 'vob', 'mpe']],
  (b) => b[0] === 0x47 && b[188] === 0x47 && b[376] === 0x47 && b[564] === 0x47 && ['video/mp2t', 'MPEG transport stream', ['ts', 'm2ts', 'mts']],
  (b) => ascii(b, 0, 'glTF') && ['model/gltf-binary', 'glTF binary model', ['glb']],
  (b) => ascii(b, 0, 'PAR1') && ['application/vnd.apache.parquet', 'Parquet', ['parquet']],
  (b) => ascii(b, 0, 'ARROW1') && ['application/vnd.apache.arrow.file', 'Arrow IPC file', ['arrow', 'feather']],
  (b) => ascii(b, 0, 'Obj\x01') && ['application/vnd.apache.avro', 'Avro', ['avro']],
  (b) => ascii(b, 0, 'gimp xcf') && ['image/x-xcf', 'GIMP image', ['xcf']],
  (b) => (at(b, 0, [0xd4, 0xc3, 0xb2, 0xa1]) || at(b, 0, [0xa1, 0xb2, 0xc3, 0xd4])) && ['application/vnd.tcpdump.pcap', 'pcap capture', ['pcap', 'cap']],
  (b) => at(b, 0, [0x0a, 0x0d, 0x0d, 0x0a]) && ['application/x-pcapng', 'pcapng capture', ['pcapng']],
  (b) => ascii(b, 0, 'AT&TFORM') && ['image/vnd.djvu', 'DjVu document', ['djvu', 'djv']],
  (b) => ascii(b, 0, 'BLENDER') && ['application/x-blender', 'Blender file', ['blend']],
  (b) => ascii(b, 0, '-----BEGIN ') && ['application/x-pem-file', 'PEM (certificate or key)', ['pem', 'crt', 'cer', 'key', 'csr', 'pub', 'asc']],
];
function zipKind(b) {
  const head = str(b, 0, Math.min(b.length, 32768));
  if (head.includes('mimetypeapplication/epub+zip')) return ['application/epub+zip', 'EPUB e-book (ZIP)', ['epub']];
  const od = /mimetypeapplication\/vnd\.oasis\.opendocument\.([a-z-]+)/.exec(head);
  if (od) return [`application/vnd.oasis.opendocument.${od[1]}`, `OpenDocument ${od[1]} (ZIP)`, ['odt', 'ods', 'odp', 'odg', 'odf', 'ott']];
  if (head.includes('[Content_Types].xml') || /^PK\x03\x04[\s\S]{26}(word|xl|ppt)\//.test(head)) {
    if (/word\//.test(head))
      return ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'Word document (OOXML, ZIP)', ['docx', 'docm', 'dotx']];
    if (/xl\//.test(head))
      return ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Excel workbook (OOXML, ZIP)', ['xlsx', 'xlsm', 'xltx']];
    if (/ppt\//.test(head))
      return ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'PowerPoint (OOXML, ZIP)', ['pptx', 'pptm', 'ppsx', 'potx']];
    return ['application/zip', 'Office Open XML (ZIP)', ZIPX];
  }
  if (head.includes('META-INF/MANIFEST.MF') || head.includes('AndroidManifest.xml') || head.includes('classes.dex'))
    return ['application/java-archive', 'Java/Android archive (ZIP)', ['jar', 'war', 'ear', 'apk', 'aab', 'zip']];
  return ['application/zip', 'ZIP archive (also docx, xlsx, jar, apk, epub…)', ZIPX];
}
function ftypKind(b) {
  const brand = str(b, 8, 4);
  if (FTYP[brand]) return FTYP[brand];
  if (FTYP[brand.trim()]) return FTYP[brand.trim()];
  return [
    'video/mp4',
    `MPEG-4 container (brand ${brand.replace(/[^\x20-\x7e]/g, '?').trim() || '?'})`,
    ['mp4', 'm4v', 'm4a', 'mov', 'mp4v', 'f4v', '3gp', 'm4b', 'heic', 'avif'],
  ];
}

/** Looks like UTF-8 / ASCII text? (no NUL bytes, decodes cleanly, few control chars) */
function textKind(b) {
  if (!b.length) return null;
  if (at(b, 0, [0xef, 0xbb, 0xbf])) return ['text/plain', 'UTF-8 text (with BOM)', null];
  if (at(b, 0, [0xff, 0xfe]) || at(b, 0, [0xfe, 0xff])) return ['text/plain', 'UTF-16 text', null];
  if (b.includes(0)) return null;
  let bad = 0;
  for (const x of b) if (x < 9 || (x > 13 && x < 32 && x !== 27)) bad++;
  if (bad > b.length / 100) return null;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(b, { stream: true });
  } catch {
    return ['text/plain', 'Text (not UTF-8; probably Latin-1 or Windows-1252)', null];
  }
  const s = new TextDecoder().decode(b.slice(0, 1024)).trimStart().toLowerCase();
  if (s.startsWith('<?xml') && s.includes('<svg')) return ['image/svg+xml', 'SVG image', ['svg']];
  if (s.startsWith('<svg')) return ['image/svg+xml', 'SVG image', ['svg']];
  if (s.startsWith('<!doctype html') || s.startsWith('<html')) return ['text/html', 'HTML document', ['html', 'htm', 'xhtml', 'shtml']];
  if (s.startsWith('<?xml')) return ['application/xml', 'XML document', null];
  if (s.startsWith('#!')) return ['text/plain', `Script (${s.split('\n')[0].slice(0, 40)})`, null];
  if (/^[{[]/.test(s)) return ['application/json', 'Text, looks like JSON', null];
  return ['text/plain', 'Text', null];
}

/**
 * Sniff bytes (Uint8Array, first ~4 KB is enough; ISO needs 32 KB+) and compare with the file name's extension.
 * Returns { type, label, ext, verdict: 'match'|'mismatch'|'noext'|'unknown'|'text', expected: string[] }.
 */
export function sniff(bytes, name = '') {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  const ext = extOf(name, false);
  const expected = typesForExt(ext);
  let hit;
  for (const f of SIGS) {
    hit = f(b);
    if (hit) break;
  }
  if (!hit) {
    const t = textKind(b);
    if (!t) return { type: null, label: b.length ? 'Unrecognised binary data' : 'Empty file', ext, verdict: 'unknown', expected };
    const [type, label, exts] = t;
    if (!exts) {
      // Text: fine as long as the extension is a textual type (or none).
      const okExt = !ext || !expected.length || expected.some(isText);
      return { type, label, ext, verdict: !ext ? 'noext' : okExt ? 'text' : 'mismatch', expected };
    }
    return { type, label, ext, verdict: !ext ? 'noext' : exts.includes(ext) ? 'match' : 'mismatch', expected };
  }
  const [type, label, exts] = hit; // '' in exts: no extension is normal (Unix executables)
  return { type, label, ext, verdict: exts.includes(ext) ? 'match' : !ext ? 'noext' : 'mismatch', expected };
}
export const SNIFF_BYTES = 0x8006; // enough for every signature, including ISO 9660 at 0x8001
