// Runs only when the app's page is opened in an ordinary browser rather than
// in the Bokeà window, which in practice means one thing: an emailed link
// (a password reset) sent the browser to this computer's Bokeà app.
//
// The one-time sign-in tokens in that link are handed to the app window, and
// removed from this tab before the website's own code can spend them, so the
// same session is never used from two places. Anything else loads normally.
(function () {
    'use strict';
    if (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.bokea) return;

    var hash = location.hash.replace(/^#/, '');
    var search = location.search.replace(/^\?/, '');
    var params = new URLSearchParams(hash + (hash && search ? '&' : '') + search);
    var isAuthLink = ['access_token', 'refresh_token', 'code', 'token_hash', 'error_description'].some(function (key) {
        return params.has(key);
    });
    if (!isAuthLink) return;

    var handedOver = false;
    try {
        var request = new XMLHttpRequest();
        request.open('POST', '/__bokea/handoff', false);
        request.setRequestHeader('Content-Type', 'application/json');
        request.send(JSON.stringify({ path: location.pathname, search: search, hash: hash }));
        handedOver = request.status === 204;
    } catch (e) {
        handedOver = false;
    }
    if (!handedOver) return;

    history.replaceState(null, '', location.pathname);

    document.addEventListener('DOMContentLoaded', function () {
        var cover = document.createElement('div');
        cover.setAttribute('role', 'alertdialog');
        cover.setAttribute('aria-labelledby', 'bokeaHandoffTitle');
        cover.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;' +
            'justify-content:center;padding:24px;background:#F8F7F5;color:#1A1A1A;' +
            "font-family:Inter,-apple-system,'Segoe UI',Roboto,sans-serif;text-align:center;";
        cover.innerHTML =
            '<div style="max-width:420px">' +
            '<h1 id="bokeaHandoffTitle" style="font-family:\'Playfair Display\',Georgia,serif;font-weight:600;font-size:2rem;margin:0 0 12px">Bokeà</h1>' +
            '<p style="font-size:1.05rem;line-height:1.5;margin:0">This link has opened in the Bokeà app on this computer. You can close this tab.</p>' +
            '</div>';
        document.body.appendChild(cover);
    }, { once: true });
})();
