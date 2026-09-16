// ---------------------------------------------------------------------------
// Runs mobile-bridge.js against the real app and checks what it did.
//
//   PLAYWRIGHT_CORE=/path/to/playwright-core node tests/bridge.mjs [webDir]
//
// www/ is served the way Capacitor serves it from the APK - from the root, with
// anything that is not a file falling back to index.html - and the page is
// opened with a stand-in for the native side that records every plugin call
// instead of making one. That is enough to answer the questions worth asking
// without a phone in the room: does the bridge attach to the app that exists,
// does Back close what is open, does the reset link leave as bokea://auth.
//
// Prints one line per check and exits non-zero on the first failure.
// ---------------------------------------------------------------------------

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

// Playwright drives the browser but is not a dependency of this project: it
// brings a browser download with it, and the build has no use for one.
const { chromium } = (() => {
  for (const candidate of [process.env.PLAYWRIGHT_CORE, 'playwright-core', 'playwright'].filter(Boolean)) {
    try {
      return require(candidate);
    } catch {
      /* try the next one */
    }
  }
  console.error(
    '\ntests/bridge: needs Playwright and its browsers.\n' +
      '  npm i -g playwright-core && npx playwright install chromium\n' +
      '  PLAYWRIGHT_CORE=/path/to/playwright-core npm test\n'
  );
  process.exit(2);
})();

const HERE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ROOT = path.resolve(process.argv[2] || path.join(HERE, 'www'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2'
};

function serve() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
      let file = path.join(ROOT, pathname);
      // Capacitor's local server answers an unknown path with index.html, which
      // is what makes the app's /tasks and /settings routes work in the APK.
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(ROOT, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// What Capacitor injects into the page before anything else runs, reduced to
// the parts the bridge uses, with every call written down instead of made.
//
// The platform is a parameter because the whole suite below is run twice, once
// as each app. That is the only way the parity this project is built on can be
// checked at all: a difference between the two is a bug here whether it shows
// up as something missing on iOS or as something Android-only leaking into it,
// and both are invisible if only one of them is ever run.
const nativeStub = (platform) => `
  window.__native = { calls: [], listeners: {}, platform: ${JSON.stringify(platform)} };
  (function () {
    function record(plugin, method, options) {
      window.__native.calls.push({ plugin: plugin, method: method, options: options });
    }
    function make(name) {
      return new Proxy({}, {
        get: function (_, method) {
          if (method === 'then') return undefined;
          return function (options, extra) {
            if (method === 'addListener') {
              window.__native.listeners[name + ':' + options] = extra;
              return Promise.resolve({ remove: function () {} });
            }
            record(name, method, options);
            if (name === 'LocalNotifications' && method === 'checkPermissions') {
              return Promise.resolve({ display: 'granted' });
            }
            if (name === 'LocalNotifications' && method === 'requestPermissions') {
              return Promise.resolve({ display: 'granted' });
            }
            if (name === 'LocalNotifications' && method === 'getPending') {
              return Promise.resolve({ notifications: [] });
            }
            return Promise.resolve({});
          };
        }
      });
    }
    var plugins = {};
    window.Capacitor = {
      Plugins: plugins,
      isNativePlatform: function () { return true; },
      getPlatform: function () { return ${JSON.stringify(platform)}; },
      registerPlugin: function (name) {
        if (!plugins[name]) plugins[name] = make(name);
        return plugins[name];
      }
    };
  })();
  // A task due later today, so there is something to schedule a reminder for.
  try {
    var due = new Date(Date.now() + 3 * 3600 * 1000);
    var hh = String(due.getHours()).padStart(2, '0') + ':' + String(due.getMinutes()).padStart(2, '0');
    localStorage.setItem('bokea_tasks_guest', JSON.stringify([{
      id: 7, name: 'Pay the water bill', type: 'fixed', isCommitment: true,
      dueDate: due.toISOString().slice(0, 10), dueTime: hh
    }]));
  } catch (e) {}
`;

let failures = 0;
function check(name, ok, detail) {
  console.log(`${ok ? '  ok  ' : '  FAIL'}  ${name}${ok || !detail ? '' : `\n          ${detail}`}`);
  if (!ok) failures++;
}

const calls = (page, plugin, method) =>
  page.evaluate(
    ([p, m]) => window.__native.calls.filter((c) => c.plugin === p && (!m || c.method === m)),
    [plugin, method]
  );

const fire = (page, listener, payload) =>
  page.evaluate(
    ([name, arg]) => {
      const handler = window.__native.listeners[name];
      if (!handler) throw new Error(`no listener for ${name}`);
      return handler(arg);
    },
    [listener, payload]
  );

// The two phones the suite is run as. The viewport is each platform's own
// common size, so the web app's phone breakpoints - the ones that read
// env(safe-area-inset-*) - are the ones under test in both runs.
const PLATFORMS = [
  { name: 'android', viewport: { width: 412, height: 915 } },
  { name: 'ios', viewport: { width: 393, height: 852 } }
];

async function run(browser, base, platform) {
  const context = await browser.newContext({ viewport: platform.viewport });
  await context.addInitScript(nativeStub(platform.name));
  const android = platform.name === 'android';
  const ios = platform.name === 'ios';

  // Nothing in this test is allowed out to the internet. The Supabase calls
  // that would go out are answered here instead, which is also how the reset
  // link gets read back.
  // Playwright gives the last route registered the first say, so the general
  // rule goes on before the one that has to beat it.
  const supabaseRequests = [];
  await context.route('**://**', async (route) => {
    const url = route.request().url();
    if (url.startsWith(base)) return route.continue();
    return route.fulfill({ status: 204, body: '' });
  });
  await context.route('**://*.supabase.co/**', async (route) => {
    supabaseRequests.push(route.request().url());
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForTimeout(600);

  console.log(`\nbridge as ${platform.name} (${path.relative(process.cwd(), ROOT)})`);

  check('the page loaded without throwing', errors.length === 0, errors.join('\n          '));
  check('the bridge is running', (await page.evaluate(() => window.BokeaNative && window.BokeaNative.platform)) === platform.name);
  check(
    `the page is marked as ${platform.name} for anything that has to know`,
    await page.evaluate(
      (name) =>
        document.documentElement.classList.contains('bokea-native') &&
        document.documentElement.classList.contains('bokea-' + name),
      platform.name
    )
  );

  // --- the splash comes down -------------------------------------------
  check('the splash is hidden once the app has painted', (await calls(page, 'SplashScreen', 'hide')).length === 1);

  // --- the bars follow the theme ---------------------------------------
  const barCalls = await calls(page, 'StatusBar', 'setStyle');
  check(
    'the status bar is told to use dark icons for the light theme',
    barCalls.length > 0 && barCalls[barCalls.length - 1].options.style === 'LIGHT',
    JSON.stringify(barCalls)
  );
  await page.evaluate(() => window.bokeaSetTheme('dark'));
  await page.waitForTimeout(150);
  const afterDark = await calls(page, 'StatusBar', 'setStyle');
  check(
    'switching to the dark theme flips them to light icons',
    afterDark[afterDark.length - 1].options.style === 'DARK',
    JSON.stringify(afterDark[afterDark.length - 1])
  );

  // The gesture bar is Android's second bar and has to be told the same thing
  // as the first. iOS has no such bar, and no plugin behind it: a call there
  // would be a silent no-op rather than an error, which is exactly the kind of
  // thing that survives to a release unnoticed.
  const navBar = await calls(page, 'SystemBars', 'setStyle');
  check(
    android
      ? 'the gesture bar is told the same as the status bar'
      : 'no gesture bar is looked for, because iOS has not got one',
    android
      ? navBar.length > 0 && navBar.every((c) => c.options.bar === 'NavigationBar')
      : navBar.length === 0,
    JSON.stringify(navBar)
  );

  // The iOS keyboard is a large piece of chrome the app cannot draw and that
  // sits right against it, so it follows the theme with everything else.
  const keyboardStyle = await calls(page, 'Keyboard', 'setStyle');
  check(
    ios
      ? 'the keyboard follows the theme too, so a dark app never raises a white one'
      : 'the keyboard style is left alone, being an iOS setting',
    ios
      ? keyboardStyle.length > 0 && keyboardStyle[keyboardStyle.length - 1].options.style === 'DARK'
      : keyboardStyle.length === 0,
    JSON.stringify(keyboardStyle)
  );

  await page.evaluate(() => window.bokeaSetTheme('light'));
  await page.waitForTimeout(150);

  if (ios) {
    const backToLight = await calls(page, 'Keyboard', 'setStyle');
    check(
      'and follows it back to light again',
      backToLight[backToLight.length - 1].options.style === 'LIGHT',
      JSON.stringify(backToLight[backToLight.length - 1])
    );
  }

  // The rubber band at the end of a scroll is the clearest tell that a thing is
  // a web view. BokeaViewController stops the document doing it; this is the
  // rule that stops every list and modal inside it.
  check(
    ios
      ? 'the elastic overscroll iOS puts on every scroller is turned off'
      : 'no iOS-only styling is injected into the Android app',
    (await page.evaluate(() => !!document.getElementById('bokea-native-ios'))) === ios
  );

  // --- Back ------------------------------------------------------------
  await page.evaluate(() => window.openCreateTaskModal());
  await page.waitForTimeout(100);
  await fire(page, 'App:backButton', { canGoBack: true });
  await page.waitForTimeout(100);
  check(
    'Back closes the task modal instead of leaving',
    !(await page.evaluate(() => document.getElementById('taskModal').classList.contains('open'))) &&
      (await calls(page, 'App', 'minimizeApp')).length === 0
  );

  await page.evaluate(() => window.switchTab('tasks'));
  await page.waitForTimeout(100);
  await fire(page, 'App:backButton', { canGoBack: true });
  await page.waitForTimeout(200);
  check(
    'Back from another tab goes back to the dashboard',
    (await page.evaluate(() => document.body.getAttribute('data-active-tab'))) === 'home' &&
      (await calls(page, 'App', 'minimizeApp')).length === 0
  );

  // The one place the two apps are deliberately told to do different things.
  // Android sends itself to the background; iOS has no way to do that and
  // Apple rejects apps that try, so the same Back must reach the end and do
  // nothing at all. Back never actually fires on iOS - the gesture behind it is
  // turned off in BokeaViewController - so this is firing an event the real app
  // will not see, which is the point: if it ever did, it must not call this.
  await fire(page, 'App:backButton', { canGoBack: false });
  await page.waitForTimeout(100);
  check(
    android
      ? 'Back on the dashboard puts the app in the background'
      : 'Back on the dashboard does not try to close the app, which iOS forbids',
    (await calls(page, 'App', 'minimizeApp')).length === (android ? 1 : 0)
  );

  // --- haptics ----------------------------------------------------------
  check(
    'ticking a task off, deleting one and every toast are felt',
    await page.evaluate(() =>
      ['completeTask', 'uncompleteTask', 'deleteTask', 'snoozeTask', 'startFocus', 'showToast']
        .every((name) => window[name] && window[name].__bokeaWrapped === true)
    )
  );
  await page.evaluate(() => window.showToast('Done.', 'success'));
  await page.waitForTimeout(100);
  const haptics = await calls(page, 'Haptics');
  check('a success toast asks for the success buzz', haptics.some((c) => c.method === 'notification' && c.options.type === 'SUCCESS'), JSON.stringify(haptics));

  // --- notifications ----------------------------------------------------
  check('the app can see a Notification API at all', await page.evaluate(() => typeof window.Notification === 'function' && window.Notification.permission === 'granted'));
  await page.evaluate(() => new window.Notification('⚠️ Overdue: Pay the water bill', { body: 'Missed.' }));
  await page.waitForTimeout(100);
  const scheduled = await calls(page, 'LocalNotifications', 'schedule');
  check(
    'an overdue alert is shown as a real notification',
    scheduled.some((c) => c.options.notifications.some((n) => /Overdue/.test(n.title))),
    JSON.stringify(scheduled.map((c) => c.options.notifications))
  );
  check(
    "a task due later today is scheduled ahead, so it arrives with the app closed",
    scheduled.some((c) =>
      c.options.notifications.some((n) => n.id >= 100000 && n.schedule && n.title === 'Pay the water bill')
    ),
    JSON.stringify(scheduled.map((c) => c.options.notifications))
  );

  // --- the reminders switch --------------------------------------------
  // Notifications are already allowed in this run, so the switch should say so
  // before it is ever touched rather than offering to turn on what is already on.
  check(
    'the switch reads as on when notifications are already allowed',
    (await page.evaluate(() => document.getElementById('pushNotifStatus').textContent)).includes('app closed')
  );
  await page.evaluate(() => document.getElementById('pushNotifToggleBtn').click());
  await page.waitForTimeout(200);
  check(
    'turning reminders off takes back what was scheduled',
    (await calls(page, 'LocalNotifications', 'cancelAll')).length === 1 &&
      (await page.evaluate(() => document.getElementById('pushNotifStatus').textContent)).startsWith('Off')
  );
  await page.evaluate(() => document.getElementById('pushNotifToggleBtn').click());
  await page.waitForTimeout(300);
  check(
    `turning them back on asks ${android ? 'Android' : 'iOS'} rather than reporting Push is missing`,
    (await calls(page, 'LocalNotifications', 'requestPermissions')).length === 1 &&
      (await page.evaluate(() => document.getElementById('pushNotifStatus').textContent)).includes('app closed')
  );

  // --- auth links -------------------------------------------------------
  check('a deep link is listened for', await page.evaluate(() => !!window.__native.listeners['App:appUrlOpen']));
  await page.evaluate(() => {
    document.getElementById('showForgotLink').click();
    document.getElementById('forgotEmailInput').value = 'someone@example.com';
    document.getElementById('forgotFormSection').requestSubmit();
  });
  await page.waitForTimeout(800);
  const recover = supabaseRequests.find((url) => url.includes('/recover'));
  check(
    'a password reset link is sent back to bokea://auth, not to localhost',
    !!recover && decodeURIComponent(recover).includes('redirect_to=bokea://auth'),
    recover || `nothing was asked of Supabase (${supabaseRequests.length} calls)`
  );

  await context.close();
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, 'js', 'mobile-bridge.js'))) {
    throw new Error(`No js/mobile-bridge.js in ${ROOT}. Run: npm run sync:web`);
  }

  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch();

  // One after the other rather than at once: the checks print as they go, and
  // two runs interleaved would be unreadable for the sake of a second saved.
  for (const platform of PLATFORMS) {
    await run(browser, base, platform);
  }

  await browser.close();
  server.close();

  console.log(failures ? `\n${failures} failed\n` : '\nall good, both platforms\n');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(`\ntests/bridge: ${err.message}\n`);
  process.exit(1);
});
