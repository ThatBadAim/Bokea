#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Builds mobile/www from Bokeà/wwwroot.
//
// The web app is the single source of truth and is never edited for the sake
// of the Android build. Everything the phone needs differently is done here,
// to the copy:
//
//   1. the whole of wwwroot is copied into www/
//   2. every remote file the page loads - Google Fonts, the icon library, the
//      Supabase client - is downloaded into www/vendor/ and the references are
//      rewritten to point at it, so a cold start with no network still paints
//      the real app rather than an unstyled page
//   3. mobile-bridge.js is dropped in next to app.js and loaded just before it
//
// Downloads are cached under .cache/, so only the first build needs network.
//
//   node scripts/sync-web.mjs
// ---------------------------------------------------------------------------

import { cp, rm, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.resolve(HERE, '..', '..', 'Bokeà', 'wwwroot');
const OUT = path.join(HERE, 'www');
const VENDOR = path.join(OUT, 'vendor');
const CACHE = path.join(HERE, '.cache', 'remote');
const BRIDGE = path.join(HERE, 'src', 'bridge', 'mobile-bridge.js');

// The hosts a copy is taken from. A reference to one of these left behind in
// the copy would be fetched over the network at run time, which the app on a
// phone must never need.
const VENDORED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'unpkg.com', 'cdn.jsdelivr.net'];

// Google Fonts serves woff2 only to a browser it recognises. Asked as Node it
// hands back the much larger ttf set.
const BROWSER_UA =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) ' +
  'Chrome/140.0.0.0 Mobile Safari/537.36';

const PRECONNECT_LINK = /^[ \t]*<link\b[^>]*\brel="preconnect"[^>]*>[ \t]*\r?\n?/gim;
const FONT_STYLESHEET = /<link\b[^>]*\bhref="(https:\/\/fonts\.googleapis\.com\/[^"]+)"[^>]*>/gi;
const CDN_SCRIPT = /<script\b[^>]*\bsrc="(https:\/\/(?:unpkg\.com|cdn\.jsdelivr\.net)\/[^"]+)"[^>]*>/gi;
const FONT_FILE_URL = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g;
const SOURCE_MAP_COMMENT = /^\/\/[#@] sourceMappingURL=.*$/gm;
const QUOTED_URL = /['"](https:\/\/[^'"\s]+)['"]/g;
const APP_SCRIPT_TAG = /([ \t]*)<script\b[^>]*\bsrc="js\/app\.js[^"]*"[^>]*><\/script>/i;

const step = (message) => console.log(`\n== ${message}`);
const note = (message) => console.log(`   ${message}`);

// Two addresses name the same file when they differ only in the version pinned
// on the last path segment: sw.js asks for "lucide@latest" where index.html
// pins an exact version, and one copy answers both.
function vendorKey(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const segments = parsed.pathname.split('/');
  const last = segments[segments.length - 1];
  // An "@" at the start of a segment is an npm scope, not a version.
  const at = last.indexOf('@', Math.min(1, last.length));
  if (at > 0) segments[segments.length - 1] = last.slice(0, at);
  return parsed.host + segments.join('/') + parsed.search;
}

async function download(url, userAgent) {
  const key = createHash('sha256').update(`${userAgent || ''}\n${url}`).digest('hex').slice(0, 16);
  const cached = path.join(CACHE, key);
  if (existsSync(cached)) return readFile(cached);

  let response;
  try {
    response = await fetch(url, { headers: userAgent ? { 'User-Agent': userAgent } : {} });
  } catch (err) {
    throw new Error(
      `Could not download ${url}: ${err.message}\n` +
        '   The first build needs network access to take a copy of the fonts and CDN scripts.\n' +
        '   Every build after that reads them from mobile/.cache/.'
    );
  }
  if (!response.ok) throw new Error(`Could not download ${url}: HTTP ${response.status}`);

  const body = Buffer.from(await response.arrayBuffer());
  await mkdir(CACHE, { recursive: true });
  await writeFile(cached, body);
  return body;
}

// A Google Fonts stylesheet, plus every font file it names, kept together so
// the CSS can point at the copies next to it.
async function vendorFonts(url, sources) {
  let css = (await download(url, BROWSER_UA)).toString('utf8');

  for (const match of [...css.matchAll(FONT_FILE_URL)]) {
    const fontUrl = match[1];
    const name = path.basename(new URL(fontUrl).pathname);
    await writeFile(path.join(VENDOR, 'fonts', name), await download(fontUrl));
    sources.set(`/vendor/fonts/${name}`, fontUrl);
    css = css.split(fontUrl).join(`/vendor/fonts/${name}`);
  }

  const cssName = `${new URL(url).searchParams.get('family')?.split(':')[0].replace(/[^\w-]/g, '-').toLowerCase() || 'fonts'}.css`;
  await writeFile(path.join(VENDOR, cssName), css, 'utf8');
  sources.set(`/vendor/${cssName}`, url);
  return `/vendor/${cssName}`;
}

async function vendorScript(url, sources) {
  const script = (await download(url)).toString('utf8').replace(SOURCE_MAP_COMMENT, '');
  // unpkg.com/lucide@1.45.0 redirects to the real file; name the copy after
  // the package rather than after whatever the last path segment happened to be.
  const segments = new URL(url).pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  const name = last.endsWith('.js') ? last : `${last.split('@')[0]}.js`;
  await writeFile(path.join(VENDOR, name), script, 'utf8');
  sources.set(`/vendor/${name}`, url);
  return `/vendor/${name}`;
}

// The page's own scripts name the same CDN files the HTML does. sw.js is the
// one that matters: it pre-caches a fixed list with cache.addAll, which fails
// as a whole if any entry cannot be fetched, so a CDN address left in it would
// stop the worker installing on a phone with no signal - the state this app is
// built to work in.
async function rewriteScripts(bundled) {
  const files = [];
  const walk = async (dir) => {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (full !== VENDOR) await walk(full);
      } else if (entry.name.endsWith('.js')) {
        files.push(full);
      }
    }
  };
  await walk(OUT);

  for (const file of files) {
    const script = await readFile(file, 'utf8');
    let rewritten = script;
    for (const match of [...script.matchAll(QUOTED_URL)]) {
      const url = match[1];
      const key = vendorKey(url);
      if (key && bundled.has(key)) rewritten = rewritten.split(url).join(bundled.get(key));
    }
    if (rewritten !== script) await writeFile(file, rewritten, 'utf8');

    for (const leftover of new Set([...rewritten.matchAll(QUOTED_URL)].map((m) => m[1]))) {
      try {
        if (VENDORED_HOSTS.includes(new URL(leftover).host)) {
          note(`note: ${path.relative(OUT, file)} still loads ${leftover}`);
        }
      } catch {
        /* not a URL we can judge */
      }
    }
  }
}

async function main() {
  if (!existsSync(path.join(SOURCE, 'index.html'))) {
    throw new Error(`No index.html in ${SOURCE}`);
  }

  step(`Web files (copied from ${path.relative(path.resolve(HERE, '..'), SOURCE)}, which is never modified)`);
  await rm(OUT, { recursive: true, force: true });
  await cp(SOURCE, OUT, { recursive: true });
  await mkdir(path.join(VENDOR, 'fonts'), { recursive: true });

  step('Remote files');
  const sources = new Map();
  const bundled = new Map();

  for (const entry of await readdir(OUT, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith('.html')) continue;
    const htmlFile = path.join(OUT, entry.name);
    let html = await readFile(htmlFile, 'utf8');

    // The copies are served from the APK, so there is nothing to preconnect to.
    html = html.replace(PRECONNECT_LINK, '');

    for (const match of [...html.matchAll(FONT_STYLESHEET)]) {
      const local = await vendorFonts(match[1], sources);
      bundled.set(vendorKey(match[1]), local);
      html = html.split(match[0]).join(match[0].replace(match[1], local));
    }
    for (const match of [...html.matchAll(CDN_SCRIPT)]) {
      const local = await vendorScript(match[1], sources);
      bundled.set(vendorKey(match[1]), local);
      html = html.split(match[0]).join(match[0].replace(match[1], local));
    }

    await writeFile(htmlFile, html, 'utf8');
    for (const leftover of html.match(/(?:src|href)="https?:\/\/[^"]+/gi) || []) {
      note(`note: ${entry.name} still loads ${leftover.split('"')[1]}`);
    }
  }

  await rewriteScripts(bundled);
  await writeFile(
    path.join(VENDOR, 'SOURCES.txt'),
    [...sources.entries()].sort().map(([local, url]) => `${local}  <=  ${url}`).join('\n') + '\n',
    'utf8'
  );
  note(`bundled ${sources.size} remote files into www/vendor`);

  step('Native bridge');
  const indexFile = path.join(OUT, 'index.html');
  let index = await readFile(indexFile, 'utf8');
  await cp(BRIDGE, path.join(OUT, 'js', 'mobile-bridge.js'));

  // Before app.js, so the bridge can wrap what app.js is about to build on
  // (the Supabase client, the Notification API), and after config.js and the
  // Supabase client itself, which it needs in place.
  if (index.includes('js/mobile-bridge.js')) {
    note('bridge already loaded by index.html');
  } else {
    const match = index.match(APP_SCRIPT_TAG);
    if (!match) throw new Error('Could not find the app.js <script> tag in index.html to load the bridge before.');
    index = index.replace(APP_SCRIPT_TAG, `${match[1]}<script src="js/mobile-bridge.js"></script>\n${match[0]}`);
    await writeFile(indexFile, index, 'utf8');
    note('js/mobile-bridge.js loads before js/app.js');
  }

  step('Done');
  note(`www is ready: ${OUT}`);
}

main().catch((err) => {
  console.error(`\nsync-web: ${err.message}`);
  process.exit(1);
});
