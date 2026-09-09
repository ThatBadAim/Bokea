// ---------------------------------------------------------------------------
// Bokeà - Accessibility layer
//
// Loaded before app.js. Everything here is device-level rather than per-account:
// someone who needs larger text needs it on the sign-in screen too, before there
// is an account to store the preference against.
//
// Provides:
//   - display preferences (text size, contrast, motion, link underlines)
//   - polite/assertive announcements for screen readers
//   - focus trapping and focus restoration for dialogs
//   - keyboard support for menus and dropdowns
// ---------------------------------------------------------------------------

(function () {
    'use strict';

    var PREFS_KEY = 'bokea_a11y_prefs';

    var DEFAULTS = {
        textSize: 'normal',    // normal | large | larger
        contrast: 'normal',    // normal | high
        motion: 'system',      // system | reduced | full
        underlineLinks: false
    };

    var prefs = Object.assign({}, DEFAULTS);

    function load() {
        try {
            prefs = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem(PREFS_KEY) || '{}'));
        } catch (e) {
            prefs = Object.assign({}, DEFAULTS);
        }
        apply();
        return prefs;
    }

    function save() {
        try {
            localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
        } catch (e) {
            /* storage blocked - preferences stay for this session only */
        }
        apply();
    }

    function set(key, value) {
        prefs[key] = value;
        save();
    }

    function get(key) {
        return key ? prefs[key] : Object.assign({}, prefs);
    }

    // The OS setting is the default; an explicit in-app choice overrides it,
    // in both directions, so someone can opt back into motion if they want it.
    function prefersReducedMotion() {
        if (prefs.motion === 'reduced') return true;
        if (prefs.motion === 'full') return false;
        return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    function apply() {
        var root = document.documentElement;
        root.setAttribute('data-text-size', prefs.textSize);
        root.setAttribute('data-contrast', prefs.contrast);
        root.setAttribute('data-underline-links', prefs.underlineLinks ? 'on' : 'off');
        root.setAttribute('data-motion', prefersReducedMotion() ? 'reduced' : 'full');
        if (document.body) {
            document.body.classList.toggle('motion-off', prefersReducedMotion());
        }
    }

    // -----------------------------------------------------------------------
    // Announcements
    //
    // Two regions, because a polite region that has just been used will not
    // re-announce an identical string, and urgent messages must not queue
    // behind chatty ones.
    // -----------------------------------------------------------------------
    var politeRegion = null;
    var assertiveRegion = null;

    function ensureRegions() {
        if (politeRegion && assertiveRegion) return;
        politeRegion = document.getElementById('a11yPoliteRegion');
        assertiveRegion = document.getElementById('a11yAssertiveRegion');

        if (!politeRegion) {
            politeRegion = document.createElement('div');
            politeRegion.id = 'a11yPoliteRegion';
            politeRegion.className = 'sr-only';
            politeRegion.setAttribute('role', 'status');
            politeRegion.setAttribute('aria-live', 'polite');
            politeRegion.setAttribute('aria-atomic', 'true');
            document.body.appendChild(politeRegion);
        }
        if (!assertiveRegion) {
            assertiveRegion = document.createElement('div');
            assertiveRegion.id = 'a11yAssertiveRegion';
            assertiveRegion.className = 'sr-only';
            assertiveRegion.setAttribute('role', 'alert');
            assertiveRegion.setAttribute('aria-live', 'assertive');
            assertiveRegion.setAttribute('aria-atomic', 'true');
            document.body.appendChild(assertiveRegion);
        }
    }

    function announce(message, assertive) {
        if (!message) return;
        ensureRegions();
        var region = assertive ? assertiveRegion : politeRegion;
        // Clear first: repeating the same string into a live region is silent
        // in most screen readers unless the content actually changes.
        region.textContent = '';
        window.setTimeout(function () {
            region.textContent = String(message);
        }, 60);
    }

    // -----------------------------------------------------------------------
    // Focus management
    // -----------------------------------------------------------------------
    var FOCUSABLE = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])'
    ].join(',');

    function focusableWithin(container) {
        if (!container) return [];
        return Array.prototype.filter.call(
            container.querySelectorAll(FOCUSABLE),
            function (el) {
                if (el.hasAttribute('hidden')) return false;
                if (el.getAttribute('aria-hidden') === 'true') return false;
                if (el.closest('[hidden]')) return false;
                if (el.closest('[aria-hidden="true"]')) return false;
                // offsetParent is null for display:none; fixed elements report
                // null too, so fall back to measuring the box.
                return el.offsetParent !== null || el.getClientRects().length > 0;
            }
        );
    }

    // Keeps Tab inside `container` and returns a function that releases the trap
    // and puts focus back where it was.
    function trapFocus(container, options) {
        var opts = options || {};
        var previouslyFocused = document.activeElement;

        function onKeydown(e) {
            if (e.key !== 'Tab') return;
            var items = focusableWithin(container);
            if (items.length === 0) {
                e.preventDefault();
                container.focus();
                return;
            }
            var first = items[0];
            var last = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === first || !container.contains(document.activeElement))) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }

        document.addEventListener('keydown', onKeydown, true);

        var initial = opts.initialFocus
            ? (typeof opts.initialFocus === 'string' ? container.querySelector(opts.initialFocus) : opts.initialFocus)
            : focusableWithin(container)[0] || container;
        if (initial && typeof initial.focus === 'function') {
            window.setTimeout(function () { initial.focus(); }, 0);
        }

        return function release(restoreFocus) {
            document.removeEventListener('keydown', onKeydown, true);
            if (restoreFocus !== false && previouslyFocused && document.contains(previouslyFocused)) {
                try { previouslyFocused.focus(); } catch (e) { /* element went away */ }
            }
        };
    }

    // Moves focus to a view's heading after a navigation, so screen reader and
    // keyboard users land where sighted users are already looking.
    function focusFirstHeading(container) {
        if (!container) return;
        var heading = container.querySelector('h1, h2, [data-focus-target]');
        if (!heading) return;
        if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
        window.setTimeout(function () {
            try { heading.focus({ preventScroll: false }); } catch (e) { heading.focus(); }
        }, 0);
    }

    // -----------------------------------------------------------------------
    // Dropdown menu keyboard behaviour: Escape closes and returns focus,
    // arrows walk the items, Home/End jump to the ends.
    // -----------------------------------------------------------------------
    function wireMenu(triggerEl, menuEl, options) {
        if (!triggerEl || !menuEl) return;
        var opts = options || {};

        function isOpen() {
            return menuEl.classList.contains('show');
        }

        function items() {
            return focusableWithin(menuEl);
        }

        triggerEl.setAttribute('aria-haspopup', opts.haspopup || 'menu');
        triggerEl.setAttribute('aria-expanded', 'false');
        if (menuEl.id) triggerEl.setAttribute('aria-controls', menuEl.id);

        function sync() {
            triggerEl.setAttribute('aria-expanded', isOpen() ? 'true' : 'false');
        }

        // Only ArrowDown is handled here. Enter and Space already fire a click
        // on a <button>, so calling click() for them would toggle twice and the
        // menu would never open.
        triggerEl.addEventListener('keydown', function (e) {
            if (e.key !== 'ArrowDown') return;
            e.preventDefault();
            if (!isOpen()) triggerEl.click();
            window.setTimeout(function () {
                var first = items()[0];
                if (first) first.focus();
                sync();
            }, 0);
        });

        // Opening with the mouse or with Enter should still land focus in the
        // menu for keyboard users who then press Tab or an arrow.
        triggerEl.addEventListener('click', function () {
            window.setTimeout(sync, 0);
        });

        menuEl.addEventListener('keydown', function (e) {
            var list = items();
            var idx = list.indexOf(document.activeElement);
            if (e.key === 'Escape') {
                e.preventDefault();
                menuEl.classList.remove('show');
                sync();
                triggerEl.focus();
            } else if (e.key === 'ArrowDown') {
                e.preventDefault();
                (list[idx + 1] || list[0] || triggerEl).focus();
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                (list[idx - 1] || list[list.length - 1] || triggerEl).focus();
            } else if (e.key === 'Home') {
                e.preventDefault();
                if (list[0]) list[0].focus();
            } else if (e.key === 'End') {
                e.preventDefault();
                if (list.length) list[list.length - 1].focus();
            } else if (e.key === 'Tab') {
                menuEl.classList.remove('show');
                sync();
            }
        });

        // The class is toggled by app.js click handlers; mirror it into ARIA.
        var observer = new MutationObserver(sync);
        observer.observe(menuEl, { attributes: true, attributeFilter: ['class'] });
        sync();
    }

    // -----------------------------------------------------------------------
    // Preference controls in Settings
    // -----------------------------------------------------------------------
    function wireSettingsControls() {
        var textSize = document.getElementById('a11yTextSize');
        var contrast = document.getElementById('a11yContrast');
        var motion = document.getElementById('a11yMotion');
        var underline = document.getElementById('a11yUnderlineLinks');

        if (textSize) {
            textSize.value = prefs.textSize;
            textSize.addEventListener('change', function () {
                set('textSize', textSize.value);
                announce('Text size set to ' + textSize.options[textSize.selectedIndex].text + '.');
            });
        }
        if (contrast) {
            contrast.value = prefs.contrast;
            contrast.addEventListener('change', function () {
                set('contrast', contrast.value);
                announce(contrast.value === 'high' ? 'High contrast on.' : 'High contrast off.');
            });
        }
        if (motion) {
            motion.value = prefs.motion;
            motion.addEventListener('change', function () {
                set('motion', motion.value);
                announce('Motion setting updated.');
            });
        }
        if (underline) {
            underline.checked = !!prefs.underlineLinks;
            underline.addEventListener('change', function () {
                set('underlineLinks', underline.checked);
                announce(underline.checked ? 'Links are underlined.' : 'Link underlines removed.');
            });
        }
    }

    // Follow the OS if the user has not made an explicit choice in the app.
    if (window.matchMedia) {
        var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        var onChange = function () { if (prefs.motion === 'system') apply(); };
        if (mq.addEventListener) mq.addEventListener('change', onChange);
        else if (mq.addListener) mq.addListener(onChange);
    }

    load();

    document.addEventListener('DOMContentLoaded', function () {
        apply();
        ensureRegions();
        wireSettingsControls();
    });

    window.BokeaA11y = {
        get: get,
        set: set,
        load: load,
        apply: apply,
        announce: announce,
        prefersReducedMotion: prefersReducedMotion,
        trapFocus: trapFocus,
        focusableWithin: focusableWithin,
        focusFirstHeading: focusFirstHeading,
        wireMenu: wireMenu
    };

    // Convenience globals used throughout app.js.
    window.announce = announce;
    window.focusFirstHeading = focusFirstHeading;
})();
