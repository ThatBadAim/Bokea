// Test builds only. Exercises each thing the host does for the page:
// a notification, a download through <a download>, and a confirm() dialog.
//
// The website only asks for notification permission from a click, which a
// script cannot fake, so run this with "NotificationsAllowed": true already in
// settings.json - the state after someone has said yes once.
(function () {
    'use strict';
    function report(message) {
        window.webkit.messageHandlers.bokea.postMessage(JSON.stringify({ type: 'error', message: '[test] ' + message, source: 'test' }));
    }

    window.addEventListener('load', function () {
        setTimeout(function () {
            report('permission at start: ' + Notification.permission);
            if (Notification.permission === 'granted') {
                var notification = new Notification('⚠️ Overdue: Water the plants', {
                    body: 'This task was marked as really important and has been missed.',
                    tag: 'bokea-test',
                    requireInteraction: true
                });
                notification.onshow = function () { report('notification shown'); };
                notification.onerror = function () { report('notification error'); };
                notification.onclick = function () { report('notification clicked'); };
            }

            var blob = new Blob([JSON.stringify({ app: 'Bokea', test: true }, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var link = document.createElement('a');
            link.href = url;
            link.download = 'bokea-backup-test.json';
            document.body.appendChild(link);
            link.click();
            link.remove();
            report('download clicked');

            // Something in local storage for the restart check.
            localStorage.setItem('bokea_test_marker', String(Date.now()));

            setTimeout(function () {
                var answer = window.confirm('Move 2 tasks into this account?\n\nChoose Cancel to start this account empty.');
                report('confirm returned ' + answer);
            }, 1500);
        }, 3000);
    });
})();
