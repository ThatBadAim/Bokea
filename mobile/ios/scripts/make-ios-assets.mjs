#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Draws the iOS app icon and launch mark from Bokeà/wwwroot/assets/icon.svg.
//
//   node scripts/make-ios-assets.mjs
//
// Writes into ios/App/App/Assets.xcassets:
//
//   AppIcon.appiconset   every size iOS asks for, 20pt through 1024pt, on a
//                        full-bleed #18181b ground with no alpha - iOS rounds
//                        the corners itself, and rejects an icon that has
//                        already been rounded or that carries transparency
//   Splash.imageset      the mark as it is drawn everywhere else, rounded
//                        corners and all, at 128pt for the launch screen
//
// The output is committed, so this only needs running when the mark changes.
// It needs one of rsvg-convert (librsvg) or magick/convert (ImageMagick);
// neither is needed to build the app.
//
// Android draws the same two things from vector XML in android/app/src/main/res
// (ic_bokea_logo, ic_bokea_tick), which is why there is no equivalent script
// for it: Android renders the vector on the device, iOS wants PNGs.
// ---------------------------------------------------------------------------

import { mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.resolve(HERE, '..', '..', 'Bokeà', 'wwwroot', 'assets', 'icon.svg');
const CATALOG = path.join(HERE, 'ios', 'App', 'App', 'Assets.xcassets');
const APPICON = path.join(CATALOG, 'AppIcon.appiconset');
const SPLASH = path.join(CATALOG, 'Splash.imageset');
const SCRATCH = path.join(HERE, '.cache', 'ios-assets');

// The ground the mark sits on, one step lighter than the app's background so
// the icon is a shape rather than a hole. The same #18181b as icon.svg itself
// and as bokea_ink in Android's colors.xml.
const INK = '#18181b';

// Every size iOS asks for, as [pixels, idiom, size in points, scale].
// The 1024 is what the App Store shows; the rest are the home screen, Settings,
// Spotlight and notifications, on both phone and tablet.
const ICONS = [
  [40, 'iphone', '20x20', '2x'],
  [60, 'iphone', '20x20', '3x'],
  [58, 'iphone', '29x29', '2x'],
  [87, 'iphone', '29x29', '3x'],
  [80, 'iphone', '40x40', '2x'],
  [120, 'iphone', '40x40', '3x'],
  [120, 'iphone', '60x60', '2x'],
  [180, 'iphone', '60x60', '3x'],
  [20, 'ipad', '20x20', '1x'],
  [40, 'ipad', '20x20', '2x'],
  [29, 'ipad', '29x29', '1x'],
  [58, 'ipad', '29x29', '2x'],
  [40, 'ipad', '40x40', '1x'],
  [80, 'ipad', '40x40', '2x'],
  [76, 'ipad', '76x76', '1x'],
  [152, 'ipad', '76x76', '2x'],
  [167, 'ipad', '83.5x83.5', '2x'],
  [1024, 'ios-marketing', '1024x1024', '1x']
];

// 128pt, the size Android centres the same mark at in splash.xml.
const SPLASH_POINTS = 128;

const step = (message) => console.log(`\n== ${message}`);
const note = (message) => console.log(`   ${message}`);

// Whichever of the two renderers this machine has. Both are told the exact
// pixel size rather than a scale factor, so a size that is not a whole multiple
// of the 512 viewBox - 87, 167 - still lands on its exact pixel count.
const RENDERERS = {
  'rsvg-convert': (svg, out, size) => ['-w', String(size), '-h', String(size), '-o', out, svg],
  magick: (svg, out, size) => ['-background', 'none', '-density', '1200', svg, '-resize', `${size}x${size}`, out],
  convert: (svg, out, size) => ['-background', 'none', '-density', '1200', svg, '-resize', `${size}x${size}`, out]
};

async function renderer() {
  for (const [command, args] of Object.entries(RENDERERS)) {
    try {
      await run(command, ['--version']);
      note(`rendering with ${command}`);
      return (svg, out, size) => run(command, args(svg, out, size));
    } catch {
      /* try the next one */
    }
  }
  throw new Error(
    'Needs librsvg or ImageMagick to turn the SVG into PNGs.\n' +
      '   Arch:   sudo pacman -S librsvg      Debian: sudo apt install librsvg2-bin\n' +
      '   macOS:  brew install librsvg\n' +
      '   The committed PNGs are only out of date if assets/icon.svg has changed.'
  );
}

// The app icon is the mark with its corners squared off and the ground taken
// out to the edge: iOS masks the shape itself, and an icon that arrives already
// rounded is drawn rounded twice, with the app's own corners cut off inside
// Apple's. `rx` is what makes them round, so it goes.
function fullBleed(svg) {
  const squared = svg.replace(/<rect\b[^>]*\/>/, (rect) => rect.replace(/\s*rx="[^"]*"/, ''));
  if (squared === svg) throw new Error('No <rect> with an rx in icon.svg to square off.');
  if (!squared.includes(INK)) note(`note: icon.svg no longer paints its ground ${INK}`);
  return squared;
}

async function main() {
  const svg = await readFile(SOURCE, 'utf8');
  const draw = await renderer();

  await mkdir(SCRATCH, { recursive: true });
  const squaredFile = path.join(SCRATCH, 'icon-square.svg');
  const roundedFile = path.join(SCRATCH, 'icon-rounded.svg');
  await writeFile(squaredFile, fullBleed(svg), 'utf8');
  await writeFile(roundedFile, svg, 'utf8');

  step('App icon');
  await rm(APPICON, { recursive: true, force: true });
  await mkdir(APPICON, { recursive: true });

  const images = [];
  const drawn = new Map();
  for (const [pixels, idiom, size, scale] of ICONS) {
    const name = `AppIcon-${pixels}.png`;
    if (!drawn.has(pixels)) {
      await draw(squaredFile, path.join(APPICON, name), pixels);
      // iOS rejects an icon with an alpha channel. The ground covers the whole
      // square so nothing shows through, but the channel itself is still there
      // and has to be flattened away.
      await flatten(path.join(APPICON, name));
      drawn.set(pixels, name);
    }
    images.push({ filename: drawn.get(pixels), idiom, scale, size });
  }
  await writeFile(
    path.join(APPICON, 'Contents.json'),
    JSON.stringify({ images, info: { author: 'bokea', version: 1 } }, null, 2) + '\n',
    'utf8'
  );
  note(`${drawn.size} icons, ${images.length} entries, 20pt to 1024pt`);

  step('Launch mark');
  await rm(SPLASH, { recursive: true, force: true });
  await mkdir(SPLASH, { recursive: true });

  const splashImages = [];
  for (const scale of [1, 2, 3]) {
    const name = `splash-${SPLASH_POINTS}${scale > 1 ? `@${scale}x` : ''}.png`;
    await draw(roundedFile, path.join(SPLASH, name), SPLASH_POINTS * scale);
    splashImages.push({ filename: name, idiom: 'universal', scale: `${scale}x` });
  }
  await writeFile(
    path.join(SPLASH, 'Contents.json'),
    JSON.stringify({ images: splashImages, info: { author: 'bokea', version: 1 } }, null, 2) + '\n',
    'utf8'
  );
  note(`${SPLASH_POINTS}pt at 1x, 2x and 3x, transparent outside the mark`);

  step('Done');
  note(`${path.relative(HERE, CATALOG)} is up to date`);
}

// Drops the alpha channel onto the mark's own ground, in place.
async function flatten(file) {
  for (const command of ['magick', 'convert']) {
    try {
      await run(command, [file, '-background', INK, '-alpha', 'remove', '-alpha', 'off', file]);
      return;
    } catch {
      /* try the next one */
    }
  }
  note(`note: could not flatten ${path.basename(file)} - install ImageMagick, or App Store Connect will reject the icon for having an alpha channel`);
}

main().catch((err) => {
  console.error(`\nmake-ios-assets: ${err.message}`);
  process.exit(1);
});
