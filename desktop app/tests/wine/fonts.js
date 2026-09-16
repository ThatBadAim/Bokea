// Test builds only. Measures the site's web fonts at several weights. The
// fonts are variable fonts, so if the engine applies the weight the widths
// differ; if it silently draws one weight for all of them, they match.
(function () {
    'use strict';
    function report(message) {
        window.webkit.messageHandlers.bokea.postMessage(JSON.stringify({ type: 'error', message: '[test] ' + message, source: 'test' }));
    }

    var samples = [
        ['Inter', [300, 400, 500, 600, 700]],
        ['Outfit', [300, 400, 700]],
        ['Playfair Display', [400, 500, 900]]
    ];

    window.addEventListener('load', function () {
        // Written by bridge.js in the previous run, just before the window was closed.
        report('storage marker from last run: ' + localStorage.getItem('bokea_test_marker'));
        var loads = [];
        samples.forEach(function (sample) {
            sample[1].forEach(function (weight) {
                loads.push(document.fonts.load(weight + ' 40px "' + sample[0] + '"'));
            });
        });
        Promise.all(loads).then(function () {
            samples.forEach(function (sample) {
                var widths = sample[1].map(function (weight) {
                    var span = document.createElement('span');
                    span.textContent = 'Hamburgefonstiv 0123';
                    span.style.cssText = 'position:absolute;left:-9999px;white-space:nowrap;font-size:40px;font-family:"' + sample[0] + '";font-weight:' + weight;
                    document.body.appendChild(span);
                    var width = span.getBoundingClientRect().width.toFixed(1);
                    span.remove();
                    return weight + '=' + width;
                });
                report('font widths ' + sample[0] + ': ' + widths.join(' '));
            });
        });
    });
})();
