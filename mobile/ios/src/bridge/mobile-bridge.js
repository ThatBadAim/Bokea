// ---------------------------------------------------------------------------
// Bokeà - native bridge
//
// Loaded by the Android and iOS builds only, from js/mobile-bridge.js,
// immediately before app.js. It is the only file that knows the app is running
// inside Capacitor rather than a browser tab, and it exists so that app.js
// never has to: nothing in here changes what the app does, only how it behaves
// as a native app.
//
//   - the splash stays up until the app has actually painted
//   - the system bars, and the iOS keyboard, follow whichever theme is on
//   - Back closes what is on top instead of leaving
//   - ticking something off is felt as well as seen
//   - the keyboard never covers the field being typed into
//   - reminders arrive with the app closed, which a web view's Push cannot do
//   - bokea://auth carries a password reset link back into the app
//
// One file covers both platforms, because on all but a handful of points they
// want the same thing and the app should feel the same on either. Where they
// differ - Android has two system bars and a hardware Back key, iOS has one
// bar, a Taptic Engine and an app that is never allowed to close itself - the
// difference is named at the point it matters and marked ANDROID or IOS, rather
// than split into two files that would drift apart.
//
// Everything is reached through window.Capacitor.registerPlugin, which talks
// to the native side directly. That keeps www a plain copy of wwwroot with one
// script added, rather than something that has to be bundled first.
// ---------------------------------------------------------------------------

(function () {
    'use strict';

    var Capacitor = window.Capacitor;
    if (!Capacitor || typeof Capacitor.isNativePlatform !== 'function' || !Capacitor.isNativePlatform()) {
        return; // a browser tab: the web app is already the right app
    }

    function plugin(name) {
        var registered = Capacitor.Plugins && Capacitor.Plugins[name];
        return registered || Capacitor.registerPlugin(name);
    }

    var App = plugin('App');
    var Haptics = plugin('Haptics');
    var Keyboard = plugin('Keyboard');
    var LocalNotifications = plugin('LocalNotifications');
    var SplashScreen = plugin('SplashScreen');
    var StatusBar = plugin('StatusBar');
    var SystemBars = plugin('SystemBars');

    var AUTH_SCHEME = 'bokea://auth';
    var DARK_BACKGROUND = '#09090b';

    var platform = (typeof Capacitor.getPlatform === 'function' && Capacitor.getPlatform()) || 'android';
    var isAndroid = platform === 'android';
    var isIOS = platform === 'ios';

    function ignore() { /* a native call that failed is never worth breaking the app for */ }
    function on(target, event, handler) {
        try { target.addListener(event, handler); } catch (e) { ignore(); }
    }
    function el(selector) {
        try { return document.querySelector(selector); } catch (e) { return null; }
    }

    // bokea-native for anything either app wants, bokea-ios / bokea-android for
    // the few places one of them needs a word to itself. The web app's own CSS
    // knows none of these; they are here for this file and for anything added
    // later that has to tell the two apart without reading the user agent.
    document.documentElement.classList.add('bokea-native', 'bokea-' + platform);

    // -----------------------------------------------------------------------
    // 0. The page as an app rather than a page
    //
    // Injected rather than written into wwwroot/css/style.css, because wwwroot
    // is the web app and is never edited for the sake of these builds. Both
    // rules are about the rubber band at the end of a scroll: iOS runs it on
    // every scrolling element, not only the document, and it is the single
    // clearest tell that what you are looking at is a web view.
    //
    // BokeaViewController turns off the web view's own bouncing natively, which
    // is the document; this is every list and modal inside it. Android has the
    // overscroll glow instead, which is already the right amount of feedback
    // there, so the rule is written for iOS and left harmless on Android, where
    // the app's own `overscroll-behavior: contain` already says most of it.
    // -----------------------------------------------------------------------
    (function noRubberBanding() {
        if (!isIOS) return;
        try {
            var style = document.createElement('style');
            style.id = 'bokea-native-ios';
            style.textContent =
                'html, body { overscroll-behavior-y: none; }' +
                // Long-press on a task row should open the row menu, not the
                // iOS callout with Copy and Look Up in it. This is the callout
                // only - text selection is left alone, because a task name is
                // worth being able to copy. Fields are put back below.
                '.bokea-ios body { -webkit-touch-callout: none; }' +
                '.bokea-ios input, .bokea-ios textarea, .bokea-ios [contenteditable] {' +
                ' -webkit-touch-callout: default; -webkit-user-select: text; }';
            (document.head || document.documentElement).appendChild(style);
        } catch (e) { ignore(); }
    })();

    // -----------------------------------------------------------------------
    // 1. Splash screen
    //
    // launchAutoHide is off, so the splash is held until this says otherwise.
    // Hiding it on load rather than after a fixed delay is what keeps the white
    // frame out: by then checkAuthToken has already decided whether the sign-in
    // screen or the dashboard is the thing behind it.
    // -----------------------------------------------------------------------
    var splashHidden = false;

    function hideSplash() {
        if (splashHidden) return;
        splashHidden = true;
        try { SplashScreen.hide({ fadeOutDuration: 200 }); } catch (e) { ignore(); }
    }

    window.addEventListener('load', function () {
        requestAnimationFrame(function () { requestAnimationFrame(hideSplash); });
    });
    // If anything at all goes wrong before that, the splash must still come
    // down - a stuck splash is the one failure with no way out of it.
    setTimeout(hideSplash, 4000);

    // -----------------------------------------------------------------------
    // 2. System bars
    //
    // The page draws under the bars, so what shows through them is the app's
    // own background. All that is left to set is the colour of what is drawn on
    // top - the clock, the battery, the gesture handle - which has to follow
    // the theme or it disappears into the page.
    //
    // ANDROID  two bars. The status bar goes through the StatusBar plugin and
    //          the gesture bar through SystemBars, because StatusBar only ever
    //          speaks for its own bar.
    // IOS      one bar, and no SystemBars plugin at all. The home indicator
    //          picks its own contrast from what is behind it and needs nothing
    //          set. What iOS does have instead is a keyboard with a colour,
    //          which is part of the same question and so answered here.
    // -----------------------------------------------------------------------
    var currentBarStyle = null;
    var currentBarColor = null;
    var currentKeyboardStyle = null;

    function isDarkSurface(color) {
        var rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color || '');
        if (!rgb) return true;
        // Rec. 709 luma, the same test Android makes for its own bar icons.
        var luma = (0.2126 * +rgb[1] + 0.7152 * +rgb[2] + 0.0722 * +rgb[3]) / 255;
        return luma < 0.5;
    }

    function toHex(color) {
        var rgb = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(color || '');
        if (!rgb) return DARK_BACKGROUND;
        return '#' + [rgb[1], rgb[2], rgb[3]].map(function (part) {
            return ('0' + (+part).toString(16)).slice(-2);
        }).join('');
    }

    function syncSystemBars() {
        var surface = document.body || document.documentElement;
        var background = window.getComputedStyle(surface).backgroundColor;
        // A transparent body means the colour is on <html> instead.
        if (!background || background === 'transparent' || /,\s*0\s*\)$/.test(background)) {
            background = window.getComputedStyle(document.documentElement).backgroundColor;
        }

        // DARK means light icons, for a dark background behind them. The same
        // word means the same thing to StatusBar, to SystemBars and to the iOS
        // keyboard, which is the one piece of luck in this whole file.
        var dark = isDarkSurface(background);
        var style = dark ? 'DARK' : 'LIGHT';
        if (style !== currentBarStyle) {
            currentBarStyle = style;
            try { StatusBar.setStyle({ style: style }); } catch (e) { ignore(); }
            // ANDROID only: there is no second bar on iOS, and no such plugin.
            if (isAndroid) {
                try { SystemBars.setStyle({ bar: 'NavigationBar', style: style }); } catch (e) { ignore(); }
            }
        }

        // IOS: the keyboard is a large piece of chrome that the app cannot draw
        // and that sits directly against it. Left alone it follows the phone's
        // appearance, so a person running the app dark on a light phone gets a
        // white keyboard under a black modal.
        //
        // DARK and LIGHT are upper case, and have to be: setStyle compares the
        // string it is given against @"DARK" and @"LIGHT" exactly, and anything
        // else falls through to UIKeyboardAppearanceDefault - which is the
        // phone's appearance, the very thing being corrected here. It resolves
        // without error either way, so a lower-case value fails silently and
        // looks from JavaScript exactly like a value that worked.
        //
        // The `style` in capacitor.config.ts is a different path and is upper
        // cased natively before the same comparison, so it would work in either
        // case. It is written upper case there too, so that the two never look
        // like they mean different things.
        if (isIOS) {
            var keyboardStyle = dark ? 'DARK' : 'LIGHT';
            if (keyboardStyle !== currentKeyboardStyle) {
                currentKeyboardStyle = keyboardStyle;
                try { Keyboard.setStyle({ style: keyboardStyle }); } catch (e) { ignore(); }
            }
        }

        // The colour behind the bars is normally the page itself, drawn under
        // them, and there is nothing to set. The exception is an Android
        // WebView older than 140, where env(safe-area-inset-*) cannot be
        // trusted and Capacitor pads the web view rather than passing the
        // insets through: the strip beside the page is then the window's own
        // background, which is dark, and under the light theme it has to be
        // told otherwise. A published inset of zero is what says we are in that
        // case. iOS has no such era and no setBackgroundColor to call.
        if (!isAndroid) return;
        var inset = parseFloat(
            window.getComputedStyle(document.documentElement).getPropertyValue('--safe-area-inset-top')
        ) || 0;
        var color = toHex(background);
        if (inset === 0 && color !== currentBarColor) {
            currentBarColor = color;
            try { StatusBar.setBackgroundColor({ color: color }); } catch (e) { ignore(); }
        }
    }

    // The theme is switched by setting data-theme on <html>, and read back off
    // the painted background rather than off the attribute, so the high
    // contrast and forced-colours modes in Settings are followed too.
    new MutationObserver(function () { setTimeout(syncSystemBars, 0); }).observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme', 'class', 'style']
    });
    window.addEventListener('load', syncSystemBars);
    syncSystemBars();

    // -----------------------------------------------------------------------
    // 3. Back
    //
    // ANDROID  the hardware key, or the swipe in from the edge that replaced
    //          it. Back means "undo the last thing that opened", in the order
    //          things stack on screen. Only on the dashboard with nothing open
    //          does it leave, and even then it puts the app in the background
    //          rather than closing it, so coming back is instant and nothing is
    //          reloaded.
    // IOS      there is no Back, and the swipe that would be it is turned off
    //          in BokeaViewController: in a one-page app it is read as a
    //          half-finished navigation and leaves a modal open over a frozen
    //          page. Everything that can be closed has a visible way to close
    //          it, which is the iOS convention anyway. The listener below is
    //          left registered rather than guarded - App.backButton simply
    //          never fires there - so there is one description of what Back
    //          means rather than two.
    //
    // Closing is done by sending Escape rather than by calling the close
    // functions directly: app.js already routes Escape to the right one for
    // whatever is open, including the tour's own handler, and that logic is
    // better shared than copied.
    // -----------------------------------------------------------------------
    function topLayer() {
        if (window.BokeaTour && window.BokeaTour.isActive && window.BokeaTour.isActive()) return 'tour';
        if (document.getElementById('rowMenu') || document.getElementById('snoozeMenu')) return 'menu';
        if (el('#taskModal.open')) return 'task modal';
        if (el('#calDayOverlay.open')) return 'calendar day';
        if (el('#avatarCropModal.open')) return 'picture';
        if (document.body.classList.contains('focus-open')) return 'focus';
        if (el('#dropdownMenuBox.show') || el('#notificationMenuBox.show')) return 'menu';
        return null;
    }

    function sendEscape() {
        var event;
        try {
            event = new KeyboardEvent('keydown', {
                key: 'Escape', code: 'Escape', keyCode: 27, which: 27,
                bubbles: true, cancelable: true
            });
        } catch (e) {
            return false;
        }
        (document.activeElement || document.body).dispatchEvent(event);
        return true;
    }

    on(App, 'backButton', function (info) {
        if (topLayer() && sendEscape()) return;

        var tab = document.body.getAttribute('data-active-tab');
        if (tab && tab !== 'home') {
            // The tab router pushes a history entry per tab, so going back
            // through them retraces the route actually taken rather than
            // jumping everyone to the dashboard.
            if (info && info.canGoBack) window.history.back();
            else if (typeof window.switchTab === 'function') window.switchTab('home');
            return;
        }

        // ANDROID only. iOS has no way for an app to send itself to the
        // background, and Apple rejects apps that try; there is nothing to do
        // here, which is consistent with Back never arriving in the first place.
        if (isAndroid) {
            try { App.minimizeApp(); } catch (e) { ignore(); }
        }
    });

    // -----------------------------------------------------------------------
    // 4. Haptics
    //
    // One buzz per thing that happened, not one per function that ran: ticking
    // a task off calls completeTask, which shows a toast, which would otherwise
    // buzz a second time a moment later. The gate is on time rather than on
    // source, which also keeps a fast run of ticks from turning into a rattle.
    //
    // Nothing below is per-platform, and that is the point: impact('LIGHT') and
    // notification('SUCCESS') are Android's vibrator and the iOS Taptic Engine
    // respectively, and the plugin already maps each word to the right one -
    // UIImpactFeedbackGenerator .light and UINotificationFeedbackGenerator
    // .success on iOS, a timed vibration on Android. So the two apps are felt
    // to be the same app because they are told the same thing, not because a
    // second set of iOS calls was written to match the first.
    //
    // IOS      the buzz is noticeably crisper, and it is silent where Android's
    //          is faintly audible. That is the hardware, and it is the one
    //          place the iOS app is allowed to feel better than its twin.
    // -----------------------------------------------------------------------
    var lastBuzz = 0;

    function buzz(call) {
        var now = Date.now();
        if (now - lastBuzz < 300) return;
        lastBuzz = now;
        try { call(); } catch (e) { ignore(); }
    }

    function impact(style) {
        buzz(function () { Haptics.impact({ style: style }); });
    }

    function feedback(type) {
        buzz(function () { Haptics.notification({ type: type }); });
    }

    function wrap(name, before) {
        var original = window[name];
        if (typeof original !== 'function' || original.__bokeaWrapped) return;
        var wrapped = function () {
            try { before.apply(null, arguments); } catch (e) { ignore(); }
            return original.apply(this, arguments);
        };
        wrapped.__bokeaWrapped = true;
        window[name] = wrapped;
    }

    function wireHaptics() {
        wrap('completeTask', function () { feedback('SUCCESS'); });
        wrap('uncompleteTask', function () { impact('LIGHT'); });
        wrap('deleteTask', function () { feedback('WARNING'); });
        wrap('snoozeTask', function () { impact('LIGHT'); });
        wrap('startFocus', function () { impact('MEDIUM'); });

        // Toasts are how the app says something landed - a streak kept, a task
        // saved, something that failed - so they are the one place where the
        // buzz can follow the news rather than the tap.
        wrap('showToast', function (message, type) {
            if (type === 'error') feedback('ERROR');
            else if (type === 'warning') feedback('WARNING');
            else if (type === 'success') feedback('SUCCESS');
            else impact('LIGHT');
        });
    }

    document.addEventListener('click', function (event) {
        var target = event.target && event.target.closest
            ? event.target.closest('button, [role="button"], .nav-item, .notification-item')
            : null;
        if (!target || target.disabled) return;
        // The tick button is answered by completeTask with a fuller buzz.
        if (target.closest('.tick-btn')) return;
        impact('LIGHT');
    }, true);

    // -----------------------------------------------------------------------
    // 5. Keyboard
    //
    // The page has to end where the keyboard begins, or the task modal's Save
    // and Cancel sit behind it. Both platforms are made to do that, by
    // different means and neither of them here:
    //
    // ANDROID  adjustResize in the manifest, and the window insets SystemBars
    //          applies from it.
    // IOS      `resize: 'body'` in capacitor.config.ts, which shortens <body>
    //          by the height of the keyboard.
    //
    // What is left for this file is the same on both: the field being typed
    // into is not scrolled into view by itself once the page has already been
    // laid out shorter. Its colour is dealt with in syncSystemBars, with the
    // rest of the chrome that has to follow the theme.
    // -----------------------------------------------------------------------
    function revealFocusedField() {
        var field = document.activeElement;
        if (!field || !field.scrollIntoView) return;
        if (!/^(INPUT|TEXTAREA|SELECT)$/.test(field.tagName)) return;
        setTimeout(function () {
            try { field.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (e) { ignore(); }
        }, 120);
    }

    on(Keyboard, 'keyboardWillShow', function (info) {
        document.documentElement.style.setProperty('--bokea-keyboard-height', ((info && info.keyboardHeight) || 0) + 'px');
        document.body.classList.add('keyboard-open');
        revealFocusedField();
    });

    on(Keyboard, 'keyboardWillHide', function () {
        document.documentElement.style.setProperty('--bokea-keyboard-height', '0px');
        document.body.classList.remove('keyboard-open');
    });

    // -----------------------------------------------------------------------
    // 6. Notifications
    //
    // A web view has neither the Notification constructor nor the Push API -
    // on iOS, Web Push exists only for a site added to the Home Screen, which
    // this is not - so on the web app's own terms neither device can ever be
    // told anything. Both are answered here with local notifications, which
    // have the better property anyway: they are scheduled on the phone and
    // arrive with the app closed and no signal.
    //
    // ANDROID  reminders are scheduled inexactly, which means "near this time,
    //          in the next idle window" rather than "to the second". Exact
    //          alarms would send the person to the Alarms & reminders settings
    //          screen on every sync until they granted it. Set EXACT_REMINDERS
    //          to true to ask instead.
    // IOS      there is no such distinction and isExactNotification is ignored;
    //          UNCalendarNotificationTrigger fires at the time it is given. iOS
    //          does cap an app at 64 pending notifications, which REMINDER_LIMIT
    //          is already well inside.
    // -----------------------------------------------------------------------
    var EXACT_REMINDERS = false;
    var REMINDER_ID_BASE = 100000;   // scheduled reminders live at and above this
    var REMINDER_LIMIT = 24;         // a fortnight of a busy list, well under iOS's cap of 64
    var REMINDER_HORIZON_DAYS = 14;
    var DEFAULT_REMINDER_TIME = '09:00';
    var REMINDERS_KEY = 'bokea_native_reminders';

    var permission = 'default';
    var instantNotifications = {};
    var instantId = 1;

    function refreshPermission() {
        try {
            return LocalNotifications.checkPermissions().then(function (status) {
                permission = status && status.display === 'granted' ? 'granted'
                    : (status && status.display === 'denied' ? 'denied' : 'default');
                NativeNotification.permission = permission;
                return permission;
            }).catch(function () { return permission; });
        } catch (e) {
            return Promise.resolve(permission);
        }
    }

    // A stand-in for the browser's Notification, close enough to the shape
    // app.js uses that checkMissedCommitmentAlerts needs no knowledge of it.
    function NativeNotification(title, options) {
        options = options || {};
        var id = instantId++;
        this.id = id;
        this.title = title;
        this.body = options.body || '';
        this.tag = options.tag || '';
        this.onclick = null;
        instantNotifications[id] = this;

        try {
            LocalNotifications.schedule({
                notifications: [{
                    id: id,
                    title: String(title == null ? 'Bokeà' : title),
                    body: String(options.body || ''),
                    autoCancel: true,
                    extra: { instant: id, tag: this.tag }
                }]
            });
        } catch (e) { ignore(); }
    }

    NativeNotification.permission = permission;
    NativeNotification.requestPermission = function (callback) {
        var result = Promise.resolve()
            .then(function () { return LocalNotifications.requestPermissions(); })
            .then(function (status) {
                permission = status && status.display === 'granted' ? 'granted' : 'denied';
                NativeNotification.permission = permission;
                if (permission === 'granted') syncReminders();
                return permission;
            })
            .catch(function () { return permission; });
        if (typeof callback === 'function') result.then(callback);
        return result;
    };
    NativeNotification.prototype.close = function () {
        delete instantNotifications[this.id];
    };

    window.Notification = NativeNotification;

    // -- scheduling -------------------------------------------------------

    function storageScope() {
        return window.storageScope || 'guest';
    }

    function storedTasks() {
        try {
            var raw = localStorage.getItem('bokea_tasks_' + storageScope());
            var parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    function workDays() {
        try {
            var stored = JSON.parse(localStorage.getItem('bokea_work_days') || 'null');
            if (Array.isArray(stored) && stored.length) return stored;
        } catch (e) { ignore(); }
        return ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    }

    var WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    function atTime(date, hhmm) {
        var parts = /^(\d{1,2}):(\d{2})$/.exec(hhmm || DEFAULT_REMINDER_TIME) || [];
        var when = new Date(date.getTime());
        when.setHours(+(parts[1] || 9), +(parts[2] || 0), 0, 0);
        return when;
    }

    function doneToday(task) {
        if (!task.lastCompleted) return false;
        var done = new Date(task.lastCompleted);
        var today = new Date();
        return done.getFullYear() === today.getFullYear()
            && done.getMonth() === today.getMonth()
            && done.getDate() === today.getDate();
    }

    // The same reading of a task app.js makes, reduced to the one question a
    // reminder needs answered: when is this next actually due?
    function dueTimes(task, now, horizon) {
        if (!task || !task.name) return [];
        if (task.snoozeUntil && new Date(task.snoozeUntil) > horizon) return [];

        var type = task.type || (task.intervalType === 'Workdays' ? 'workdays'
            : (task.intervalType === 'FixedDate' ? 'fixed' : 'interval'));
        var snoozedUntil = task.snoozeUntil ? new Date(task.snoozeUntil) : null;
        var times = [];

        if (type === 'workdays') {
            if (!task.dueTime) return []; // due "some time on a workday" is not a moment
            var days = workDays();
            for (var offset = 0; offset < REMINDER_HORIZON_DAYS; offset++) {
                var day = new Date(now.getTime() + offset * 86400000);
                if (days.indexOf(WEEKDAYS[day.getDay()]) === -1) continue;
                if (offset === 0 && doneToday(task)) continue;
                times.push(atTime(day, task.dueTime));
                if (times.length >= 5) break;
            }
        } else if (type === 'fixed') {
            if (!task.dueDate || task.lastCompleted) return [];
            var dateStr = String(typeof task.dueDate === 'string' ? task.dueDate : (task.dueDate.value || '')).split('T')[0];
            if (!dateStr) return [];
            var parts = dateStr.split('-');
            times.push(atTime(new Date(+parts[0], +parts[1] - 1, +parts[2]), task.dueTime));
        } else {
            var interval = parseInt(task.intervalDays, 10) || 1;
            var base = task.lastCompleted ? new Date(task.lastCompleted)
                : (task.dueDate ? new Date(new Date(task.dueDate).getTime() - interval * 86400000)
                    : new Date(task.createdAt || now));
            var due = new Date(base.getTime() + interval * 86400000);
            times.push(atTime(due, task.dueTime));
        }

        return times.filter(function (time) {
            if (isNaN(time.getTime()) || time <= now || time > horizon) return false;
            return !(snoozedUntil && time < snoozedUntil);
        });
    }

    function reminderText(task) {
        if (task.isCommitment === true || task.isCommitment === 1) {
            return { title: task.name, body: 'Due now. This one really matters.' };
        }
        return { title: task.name, body: 'Due now.' };
    }

    var lastSync = 0;
    var syncing = false;

    function syncReminders(force) {
        if (permission !== 'granted') return Promise.resolve();
        if (localStorage.getItem(REMINDERS_KEY) === 'off') return Promise.resolve();
        // Two syncs at once would schedule everything twice: the second reads
        // the pending list before the first has written to it.
        if (syncing) return Promise.resolve();
        var now = Date.now();
        if (!force && now - lastSync < 10000) return Promise.resolve();
        syncing = true;
        lastSync = now;

        var at = new Date(now);
        var horizon = new Date(now + REMINDER_HORIZON_DAYS * 86400000);
        var planned = [];

        storedTasks().forEach(function (task) {
            dueTimes(task, at, horizon).forEach(function (time) {
                planned.push({ task: task, time: time });
            });
        });

        planned.sort(function (a, b) { return a.time - b.time; });
        planned = planned.slice(0, REMINDER_LIMIT);

        var notifications = planned.map(function (entry, index) {
            var text = reminderText(entry.task);
            return {
                id: REMINDER_ID_BASE + index,
                title: text.title,
                body: text.body,
                schedule: { at: entry.time.toISOString(), allowWhileIdle: true },
                isExactNotification: EXACT_REMINDERS,
                autoCancel: true,
                extra: { taskId: entry.task.id }
            };
        });

        // Everything is rebuilt from scratch each time rather than diffed:
        // a task can move, be ticked off or be deleted between two syncs, and
        // a reminder for a version of it that no longer exists is worse than
        // no reminder at all.
        return Promise.resolve()
            .then(function () { return LocalNotifications.getPending(); })
            .then(function (pending) {
                var ours = ((pending && pending.notifications) || []).filter(function (item) {
                    return item.id >= REMINDER_ID_BASE;
                });
                if (!ours.length) return null;
                return LocalNotifications.cancel({ notifications: ours.map(function (item) { return { id: item.id }; }) });
            })
            .then(function () {
                if (!notifications.length) return null;
                return LocalNotifications.schedule({ notifications: notifications });
            })
            .catch(ignore)
            .then(function () { syncing = false; });
    }

    on(LocalNotifications, 'localNotificationActionPerformed', function (action) {
        var extra = (action && action.notification && action.notification.extra) || {};

        var instant = instantNotifications[extra.instant];
        if (instant && typeof instant.onclick === 'function') {
            try { instant.onclick(); } catch (e) { ignore(); }
            return;
        }
        if (extra.taskId != null && typeof window.openEditTaskModal === 'function') {
            try { window.openEditTaskModal(extra.taskId); } catch (e) { ignore(); }
        }
    });

    // -- the reminders switch in Settings ---------------------------------
    //
    // The web app's switch subscribes to Web Push, which neither web view can
    // do, so it would only ever report that this browser does not support it.
    // The click is taken here first and answered with the thing that does work.
    function describeReminders(enabled) {
        var label = document.getElementById('pushNotifToggleLabel');
        var status = document.getElementById('pushNotifStatus');
        var button = document.getElementById('pushNotifToggleBtn');
        if (!label || !status || !button) return;
        label.textContent = enabled ? 'Turn off reminders' : 'Turn on reminders';
        status.textContent = enabled
            ? 'Reminders are on. They arrive even with the app closed.'
            : 'Off. Your device will ask permission the first time.';
        button.dataset.enabled = enabled ? 'true' : 'false';
    }

    function remindersOn() {
        return permission === 'granted' && localStorage.getItem(REMINDERS_KEY) !== 'off';
    }

    document.addEventListener('click', function (event) {
        var button = event.target && event.target.closest && event.target.closest('#pushNotifToggleBtn');
        if (!button) return;
        event.preventDefault();
        event.stopImmediatePropagation();

        if (remindersOn()) {
            localStorage.setItem(REMINDERS_KEY, 'off');
            try { LocalNotifications.cancelAll(); } catch (e) { ignore(); }
            describeReminders(false);
            if (typeof window.showToast === 'function') window.showToast('Reminders are off.');
            return;
        }

        localStorage.setItem(REMINDERS_KEY, 'on');
        NativeNotification.requestPermission().then(function (result) {
            describeReminders(result === 'granted');
            if (typeof window.showToast !== 'function') return;
            if (result === 'granted') window.showToast('Reminders are on for this device.', 'success');
            // Named, because "your device" sends nobody anywhere: the switch to
            // find is under Settings - Apps - Bokeà on Android and Settings -
            // Bokeà - Notifications on iOS, and the person has to be told which
            // phone they are holding before they can be told where to look.
            else if (isIOS) window.showToast('iOS is holding notifications back for Bokeà. Turn them on in Settings - Bokeà - Notifications.', 'warning');
            else window.showToast('Android is holding notifications back for Bokeà. Turn them on in Settings.', 'warning');
        });
    }, true);

    // -----------------------------------------------------------------------
    // 7. Deep links and email links
    //
    // A reset link has to leave the phone's browser and come back into the app
    // carrying its fragment. app.js reads that fragment once, as it loads, to
    // decide whether to show the reset form - so the fragment is put in place
    // and the page is reloaded, which is the only way it gets read at all.
    //
    // One scheme serves both apps and so one redirect URL does: bokea://auth is
    // declared in Android's manifest as an intent-filter and in the iOS
    // Info.plist as a CFBundleURLType, and arrives here as the same event from
    // either. Nothing below is per-platform.
    // -----------------------------------------------------------------------
    on(App, 'appUrlOpen', function (event) {
        var url = (event && event.url) || '';
        if (url.indexOf('bokea://') !== 0) return;

        var hash = url.indexOf('#') >= 0 ? url.slice(url.indexOf('#') + 1) : '';
        var query = '';
        var questionMark = url.indexOf('?');
        if (questionMark >= 0) query = url.slice(questionMark + 1, hash ? url.indexOf('#') : url.length);

        var target = '/' + (query ? '?' + query : '') + (hash ? '#' + hash : '');
        try {
            window.history.replaceState(null, '', target);
            window.location.reload();
        } catch (e) {
            window.location.href = target;
        }
    });

    // Supabase is told to send people back to https://localhost - or, on iOS,
    // capacitor://localhost - which is this app's own address inside the web
    // view and useless in an email. Every link it sends from here is pointed at
    // bokea://auth instead, which the phone hands back to the app. The redirect
    // has to be allowed in the Supabase dashboard under Authentication - URL
    // Configuration.
    (function redirectAuthLinksToTheApp() {
        var supabase = window.supabase;
        if (!supabase || typeof supabase.createClient !== 'function') return;

        var createClient = supabase.createClient;
        supabase.createClient = function () {
            var client = createClient.apply(this, arguments);
            try {
                redirect(client.auth, 'resetPasswordForEmail', 1, 'redirectTo');
                redirect(client.auth, 'signInWithOtp', 0, 'emailRedirectTo');
                redirect(client.auth, 'signUp', 0, 'emailRedirectTo');
                redirect(client.auth, 'resend', 0, 'emailRedirectTo');
            } catch (e) { ignore(); }
            return client;
        };

        function redirect(auth, method, optionsAt, key) {
            var original = auth && auth[method];
            if (typeof original !== 'function') return;
            auth[method] = function () {
                var args = Array.prototype.slice.call(arguments);
                var options = args[optionsAt] = args[optionsAt] || {};
                if (key === 'redirectTo') options.redirectTo = AUTH_SCHEME;
                else (options.options = options.options || {})[key] = AUTH_SCHEME;
                return original.apply(auth, args);
            };
        }
    })();

    // -----------------------------------------------------------------------
    // 8. Wiring that has to wait for app.js
    // -----------------------------------------------------------------------
    document.addEventListener('DOMContentLoaded', function () {
        // app.js defines its globals while it is parsed, so by now they exist.
        wireHaptics();

        // Reminders follow the task list. loadDashboardData is where the list
        // becomes whatever it is about to be, whether that came from Supabase
        // or from localStorage, so it is the one place worth listening at.
        var loadDashboardData = window.loadDashboardData;
        if (typeof loadDashboardData === 'function' && !loadDashboardData.__bokeaWrapped) {
            var wrapped = function () {
                var result = loadDashboardData.apply(this, arguments);
                Promise.resolve(result).then(function () { syncReminders(); }, ignore);
                return result;
            };
            wrapped.__bokeaWrapped = true;
            window.loadDashboardData = wrapped;
        }

        // The switch in Settings is built when the tab is first opened.
        var switchTab = window.switchTab;
        if (typeof switchTab === 'function' && !switchTab.__bokeaWrapped) {
            var wrappedTab = function (tab) {
                var result = switchTab.apply(this, arguments);
                if (tab === 'settings') setTimeout(function () { describeReminders(remindersOn()); }, 0);
                return result;
            };
            wrappedTab.__bokeaWrapped = true;
            window.switchTab = wrappedTab;
        }

        refreshPermission().then(function () {
            // The switch has to read as whatever the bridge actually thinks,
            // from the start. Left to the web app it would say "off" while
            // reminders were on, and the first tap would turn off something
            // the person had never been told was running.
            describeReminders(remindersOn());
            syncReminders(true);
        });
    });

    // Coming back to the app is the moment its idea of the world is most
    // likely to be out of date: a day may have turned over, a reminder may
    // have been acted on, permission may have been taken away in Settings.
    on(App, 'appStateChange', function (state) {
        if (!state || !state.isActive) return;
        syncSystemBars();
        refreshPermission().then(function () {
            // The switch has to read as whatever the bridge actually thinks,
            // from the start. Left to the web app it would say "off" while
            // reminders were on, and the first tap would turn off something
            // the person had never been told was running.
            describeReminders(remindersOn());
            syncReminders(true);
        });
    });

    // Something for the console, and a handle for anything that wants to know
    // it is running natively without sniffing the user agent.
    window.BokeaNative = {
        platform: platform,
        syncReminders: function () { return syncReminders(true); },
        remindersOn: remindersOn,
        hideSplash: hideSplash
    };
})();
