'use strict';
// Measures what one cold page load costs, against the bundled copy served the
// way the desktop app serves it: no compression, no-cache with an ETag.
//
//   PLAYWRIGHT_CORE=/path/to/playwright-core node tests/load-cost.js [webDir]
//
// ENGINE=webkit (default) is the desktop app's own engine revision; ENGINE=chromium
// is the website as most people see it. WEBKIT_EXECUTABLE may point at a Playwright
// WebKit launcher when the default one cannot run on this machine. RUNS=n repeats
// the measurement (default 3) and reports the median.
//
// It reports where the time goes, not a pass or fail: the numbers are only
// comparable against another run on the same machine.

const http = require('http');
const fs = require('fs');
const path = require('path');
const pw = require(process.env.PLAYWRIGHT_CORE || 'playwright-core');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..', 'build', 'web'));
const engine = process.env.ENGINE || 'webkit';
const runs = Number(process.env.RUNS || 3);

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
};

// The same routing and headers as AppServer.cs, so the byte counts and the
// number of round trips match what the app itself does.
function serve() {
    return new Promise(resolve => {
        const server = http.createServer((req, res) => {
            const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
            let file = path.join(root, pathname);
            if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
                const html = path.join(root, pathname + '.html');
                file = fs.existsSync(html) && html.startsWith(root) ? html : path.join(root, 'index.html');
            }
            const info = fs.statSync(file);
            const etag = `"${info.size.toString(16)}-${info.mtimeMs.toString(16)}"`;
            if (req.headers['if-none-match'] === etag) {
                res.writeHead(304, { 'Cache-Control': 'no-cache', ETag: etag });
                res.end();
                return;
            }
            res.writeHead(200, {
                'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
                'Content-Length': info.size,
                'Cache-Control': 'no-cache',
                ETag: etag,
                'X-Content-Type-Options': 'nosniff',
            });
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

function median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.floor(sorted.length / 2)];
}

function kb(bytes) {
    return `${(bytes / 1024).toFixed(0)} KB`;
}

async function measure(browser, origin) {
    // A new context every run, so nothing is cached and nothing is left over.
    const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        serviceWorkers: 'block',
        locale: 'en-GB',
        timezoneId: 'Europe/London',
    });
    await context.addInitScript(storage => {
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value);
    }, LOCAL);

    const resources = [];
    const page = await context.newPage();
    page.on('response', async response => {
        const request = response.request();
        let bytes = 0;
        try { bytes = (await response.body()).length; } catch { /* no body kept */ }
        resources.push({ url: new URL(request.url()).pathname, type: request.resourceType(), status: response.status(), bytes });
    });

    const started = Date.now();
    await page.goto(origin + '/', { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const settled = Date.now() - started;
    const cold = [...resources];

    // What F5 costs: everything is in the engine's cache, so the server
    // answers each file with a 304 and the work is parsing it again.
    resources.length = 0;
    await page.reload({ waitUntil: 'load' });
    const warm = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] || {};
        return nav.loadEventEnd;
    });
    const revalidated = resources.filter(r => r.status === 304).length;
    resources.length = 0;
    resources.push(...cold);

    const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] || {};
        const paint = Object.fromEntries(performance.getEntriesByType('paint').map(e => [e.name, e.startTime]));
        return {
            domInteractive: nav.domInteractive,
            domContentLoaded: nav.domContentLoadedEventEnd,
            load: nav.loadEventEnd,
            firstPaint: paint['first-paint'],
            firstContentfulPaint: paint['first-contentful-paint'],
            nodes: document.getElementsByTagName('*').length,
            styleSheetRules: [...document.styleSheets].reduce((total, sheet) => {
                try { return total + sheet.cssRules.length; } catch { return total; }
            }, 0),
        };
    });

    await context.close();
    return { timing, resources, settled, warm, revalidated };
}

(async () => {
    const server = await serve();
    const origin = `http://127.0.0.1:${server.address().port}`;
    const options = engine === 'webkit' && process.env.WEBKIT_EXECUTABLE
        ? { executablePath: process.env.WEBKIT_EXECUTABLE }
        : {};
    const browser = await pw[engine].launch(options);
    try {
        const samples = [];
        for (let i = 0; i < runs; i++) samples.push(await measure(browser, origin));

        const last = samples[samples.length - 1];
        const fromServer = last.resources.filter(r => r.status === 200);
        const total = fromServer.reduce((sum, r) => sum + r.bytes, 0);

        console.log(`${engine} ${browser.version()} - ${root}`);
        console.log(`\nOne cold load, median of ${runs}:`);
        for (const [label, key] of [
            ['first paint', 'firstPaint'],
            ['first contentful paint', 'firstContentfulPaint'],
            ['DOM interactive', 'domInteractive'],
            ['DOMContentLoaded', 'domContentLoaded'],
            ['load', 'load'],
        ]) {
            const value = median(samples.map(s => s.timing[key]).filter(Number.isFinite));
            console.log(`  ${label.padEnd(24)} ${value === undefined ? 'n/a' : `${value.toFixed(0)} ms`}`);
        }
        console.log(`  ${'fonts ready'.padEnd(24)} ${median(samples.map(s => s.settled))} ms`);
        console.log(`\nReload (F5), median of ${runs}: ${median(samples.map(s => s.warm)).toFixed(0)} ms, ` +
            `${last.revalidated} files answered 304`);

        console.log(`\nServed: ${fromServer.length} files, ${kb(total)}`);
        const byType = {};
        for (const r of fromServer) {
            byType[r.type] ??= { count: 0, bytes: 0 };
            byType[r.type].count++;
            byType[r.type].bytes += r.bytes;
        }
        for (const [type, t] of Object.entries(byType).sort((a, b) => b[1].bytes - a[1].bytes))
            console.log(`  ${type.padEnd(12)} ${String(t.count).padStart(3)} files  ${kb(t.bytes).padStart(9)}`);

        console.log('\nLargest:');
        for (const r of [...fromServer].sort((a, b) => b.bytes - a.bytes).slice(0, 8))
            console.log(`  ${kb(r.bytes).padStart(9)}  ${r.url}`);

        console.log(`\nPage: ${last.timing.nodes} elements, ${last.timing.styleSheetRules} CSS rules`);
    } finally {
        await browser.close();
        server.close();
    }
})().catch(error => {
    console.error(error);
    process.exit(1);
});
