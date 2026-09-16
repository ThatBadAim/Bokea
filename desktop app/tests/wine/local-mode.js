// Test builds only (see AppWindow.cs, BOKEA_TEST_SCRIPT). Opens the app in
// local mode, as "Just let me start" would, and reports what the page sees to
// the app log so a run can be checked without anyone looking at the screen.
(function () {
    'use strict';
    if (!localStorage.getItem('bokea_local_mode')) {
        localStorage.setItem('bokea_local_mode', 'true');
        localStorage.setItem('bokea_setup_completed', 'true');
        localStorage.setItem('bokea_username', 'Sam');
        localStorage.setItem('bokea_tutorial_done_guest', 'true');
        location.reload();
        return;
    }

    function report(message) {
        window.webkit.messageHandlers.bokea.postMessage(JSON.stringify({ type: 'error', message: '[test] ' + message, source: 'test' }));
    }

    window.addEventListener('load', function () {
        setTimeout(function () {
            report('viewport ' + innerWidth + 'x' + innerHeight + ' dpr ' + devicePixelRatio);
            report('userAgent ' + navigator.userAgent);
            var loaded = [];
            document.fonts.forEach(function (face) {
                if (face.status === 'loaded') loaded.push(face.family + ' ' + face.weight);
            });
            report('fonts loaded: ' + loaded.join(', '));
            report('Notification: ' + (typeof Notification !== 'undefined' ? Notification.permission : 'missing') +
                ', serviceWorker: ' + ('serviceWorker' in navigator) + ', PushManager: ' + ('PushManager' in window));
            report('greeting font: ' + getComputedStyle(document.querySelector('.welcome-text')).fontFamily + ' / ' +
                getComputedStyle(document.querySelector('.welcome-text')).fontWeight);
            report('localStorage keys: ' + Object.keys(localStorage).join(', '));
        }, 4000);
    });
})();
