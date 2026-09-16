// Bokeà desktop bridge.
//
// Injected at document start into the app window only. It does not change
// the page: the website runs exactly as it does in a browser. It only tells
// the Windows host things the host cannot see for itself.
(function () {
    'use strict';

    var handlers = window.webkit && window.webkit.messageHandlers;
    var host = handlers && handlers.bokea;
    if (!host || window.bokeaDesktop) return;

    function post(message) {
        try { host.postMessage(JSON.stringify(message)); } catch (e) { /* host gone */ }
    }

    Object.defineProperty(window, 'bokeaDesktop', {
        value: Object.freeze({ platform: 'windows' }),
        enumerable: false
    });

    // The title bar takes the colour of the page behind it, so the window
    // reads as one surface in both the light and the dark theme.
    var lastTheme = '';
    function reportTheme() {
        var body = document.body;
        if (!body) return;
        var background = getComputedStyle(body).backgroundColor;
        var dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
            body.classList.contains('dark-theme');
        var key = background + '|' + dark;
        if (key === lastTheme) return;
        lastTheme = key;
        post({ type: 'theme', background: background, dark: dark });
    }

    var soon = 0;
    var settled = 0;
    function scheduleTheme() {
        clearTimeout(soon);
        clearTimeout(settled);
        soon = setTimeout(reportTheme, 30);
        // The theme switch animates; read the colour again once it has landed.
        settled = setTimeout(reportTheme, 700);
    }

    function watchTheme() {
        reportTheme();
        var attributes = { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-contrast'] };
        var observer = new MutationObserver(scheduleTheme);
        observer.observe(document.documentElement, attributes);
        observer.observe(document.body, attributes);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watchTheme, { once: true });
    } else {
        watchTheme();
    }

    // Script errors go to the host's log file, which is the only place they
    // can be read on a machine without developer tools open.
    var reported = 0;
    function reportError(message, source) {
        if (reported++ > 50) return;
        post({ type: 'error', message: String(message).slice(0, 2000), source: String(source || '').slice(0, 300) });
    }
    window.addEventListener('error', function (event) {
        reportError(event.message, (event.filename || '') + ':' + (event.lineno || 0));
    });
    window.addEventListener('unhandledrejection', function (event) {
        var reason = event.reason;
        reportError(reason && reason.stack ? reason.stack : reason, 'unhandledrejection');
    });
})();
