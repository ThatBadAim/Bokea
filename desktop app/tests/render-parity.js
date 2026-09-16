'use strict';
// Renders the same screens twice and saves both side by side, with a diff.
//
//   COMPARE=engines (default)  the bundled web copy in Chromium (how most people
//                              see the website) and in WebKit (the desktop app's
//                              engine, same revision)
//   COMPARE=source             the website as deployed (Bokeà/wwwroot, fonts and
//                              scripts from their CDNs) and the desktop app's
//                              bundled copy, both in Chromium, which shows what
//                              the build's changes to the copy do to the look
//
//   PLAYWRIGHT_CORE=/path/to/playwright-core node tests/render-parity.js [webDir] [outDir]
//
// WEBKIT_EXECUTABLE may point at a Playwright WebKit launcher when the
// default one cannot run on this machine. SCENARIOS=home,settings limits the run.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const copyRoot = path.resolve(process.argv[2] || path.join(__dirname, '..', 'build', 'web'));
const sourceRoot = path.resolve(process.env.SOURCE_ROOT || path.join(__dirname, '..', '..', 'Bokeà', 'wwwroot'));
const out = path.resolve(process.argv[3] || path.join(__dirname, '..', 'build', 'parity'));
const only = process.env.SCENARIOS ? process.env.SCENARIOS.split(',') : null;

const SIDES = process.env.COMPARE === 'source'
    ? [{ label: 'website', engine: 'chromium', root: sourceRoot }, { label: 'desktop-copy', engine: 'chromium', root: copyRoot }]
    : [{ label: 'chromium', engine: 'chromium', root: copyRoot }, { label: 'webkit', engine: 'webkit', root: copyRoot }];

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2',
};

// Same routing as vercel.json and the desktop app server: files first, then index.html.
function serve(root) {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
            let file = path.join(root, pathname);
            if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                const html = path.join(root, pathname + '.html');
                file = fs.existsSync(html) && html.startsWith(root) ? html : path.join(root, 'index.html');
            }
            res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
            fs.createReadStream(file).pipe(res);
        });
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

const LOCAL = {
    bokea_local_mode: 'true',
    bokea_setup_completed: 'true',
    bokea_username: 'Sam',
    bokea_tutorial_done_guest: 'true',
};

// `tab` is the nav button's data-tab value, which is not always the word on
// screen: the screen labelled "Patterns" is data-tab="analytics", and
// "Everything" is data-tab="tasks".
const SCENARIOS = [
    { name: 'welcome', storage: {} },
    { name: 'home', storage: LOCAL },
    { name: 'home-dark', storage: { ...LOCAL, bokea_theme: 'dark' } },
    { name: 'everything', storage: LOCAL, tab: 'tasks' },
    { name: 'patterns', storage: LOCAL, tab: 'analytics' },
    { name: 'calendar', storage: LOCAL, tab: 'calendar' },
    { name: 'settings', storage: LOCAL, tab: 'settings' },
    { name: 'profile', storage: LOCAL, tab: 'profile' },
    { name: 'new-task', storage: LOCAL, action: 'openCreateTaskModal' },
];

const VIEWPORTS = [
    { width: 1280, height: 800 },
    { width: 900, height: 700 },
    { width: 420, height: 860 },
];

async function render(side) {
    // Headless Chromium hides scrollbars by default; the desktop app has them, so show them here too.
    const options = side.engine === 'webkit'
        ? (process.env.WEBKIT_EXECUTABLE ? { executablePath: process.env.WEBKIT_EXECUTABLE } : {})
        : { ignoreDefaultArgs: ['--hide-scrollbars'] };
    const server = await serve(side.root);
    const origin = `http://127.0.0.1:${server.address().port}`;
    const browser = await pw[side.engine].launch(options);
    const problems = [];
    try {
        for (const viewport of VIEWPORTS) {
            for (const scenario of SCENARIOS) {
                if (only && !only.includes(scenario.name)) continue;
                const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'en-GB', timezoneId: 'Europe/London' });
                await context.clock.install({ time: new Date('2026-09-15T09:41:00+01:00') });
                await context.addInitScript(storage => {
                    if (location.pathname === '/' && !sessionStorage.getItem('__seeded')) {
                        localStorage.clear();
                        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
                        sessionStorage.setItem('__seeded', '1');
                    }
                }, scenario.storage);
                const page = await context.newPage();
                page.on('pageerror', e => problems.push(`${side.label} ${scenario.name}: ${e.message}`));
                await page.goto(origin + '/', { waitUntil: 'load' });
                await page.clock.runFor(1500);
                // A scenario that cannot reach its screen must stop the run.
                // Skipping it quietly would save a second copy of the home
                // screen under that name, and the comparison would pass.
                if (scenario.tab) {
                    const opened = await page.evaluate(tab => {
                        const item = document.querySelector(`button[data-tab="${tab}"]`);
                        if (!item) return false;
                        item.click();
                        return true;
                    }, scenario.tab);
                    if (!opened)
                        throw new Error(`${scenario.name}: no nav button with data-tab="${scenario.tab}"`);
                    await page.clock.runFor(800);
                }
                if (scenario.action) {
                    const ran = await page.evaluate(action => {
                        if (typeof window[action] !== 'function') return false;
                        window[action]();
                        return true;
                    }, scenario.action);
                    if (!ran)
                        throw new Error(`${scenario.name}: window.${scenario.action} is not a function`);
                    await page.clock.runFor(800);
                }
                await page.evaluate(() => document.fonts.ready);
                await page.waitForTimeout(300);
                await page.screenshot({ path: path.join(out, `${scenario.name}-${viewport.width}-${side.label}.png`) });
                await context.close();
            }
        }
    } finally {
        await browser.close();
        server.close();
    }
    return problems;
}

(async () => {
    fs.mkdirSync(out, { recursive: true });
    const problems = [];
    for (const side of SIDES)
        problems.push(...await render(side));

    // Pixel difference per pair, when ImageMagick is available. Text is
    // antialiased differently by different engines, so a small number is
    // normal; what matters is a large one, and the images themselves.
    for (const viewport of VIEWPORTS) {
        for (const scenario of SCENARIOS) {
            if (only && !only.includes(scenario.name)) continue;
            const base = path.join(out, `${scenario.name}-${viewport.width}`);
            const [a, b] = SIDES.map(side => `${base}-${side.label}.png`);
            const total = viewport.width * viewport.height;
            // compare writes the metric to stderr, and exits 1 whenever the images differ at all.
            const result = spawnSync('magick', ['compare', '-metric', 'AE', '-fuzz', '12%', a, b, `${base}-${SIDES[0].label}-vs-${SIDES[1].label}.png`],
                { encoding: 'utf8' });
            const text = `${result.stderr || ''}${result.stdout || ''}${result.error ? result.error.message : ''}`;
            const pixels = parseInt(text.trim(), 10);
            console.log(`${scenario.name} @${viewport.width}: ${Number.isFinite(pixels) ? `${pixels} px differ (${(100 * pixels / total).toFixed(2)}%)` : text.trim()}`);
        }
    }
    if (problems.length) console.log('\nPage errors:\n' + problems.join('\n'));
})().catch(error => {
    console.error(error);
    process.exit(1);
});
