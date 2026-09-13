// ---------------------------------------------------------------------------
// Bokeà - Guided tutorial
//
// Runs once for every new account, immediately after the schedule setup screen,
// and can be replayed from Settings or the account menu at any time.
//
// Design constraints this file is written against:
//   - It must be completable with the keyboard alone, and with a screen reader.
//   - It must never be a trap: Escape leaves, "Skip" is on every step, and
//     leaving early still counts as "seen" so it doesn't ambush the user again.
//   - It must not put any data in the account. The last step offers example
//     tasks, but only if the user asks for them by name.
//   - It must respect reduced-motion.
// ---------------------------------------------------------------------------

(function () {
    'use strict';

    var a11y = window.BokeaA11y;

    // Each step points at a real element so the tour explains the app itself
    // rather than a picture of it. `target` may be missing for intro/outro
    // steps, which are centred instead.
    // Three steps, not nine.
    //
    // The old tour opened with "this takes about a minute" and then walked
    // through nine modal steps of an account with nothing in it - explaining
    // an empty Right Now card, an empty fold, an empty Patterns screen. It
    // taught the furniture rather than the app, and it stood between signing
    // up and doing anything.
    //
    // What is left is the three things that are genuinely not guessable:
    // that the top of the screen only ever holds one thing, that the box at
    // the bottom takes anything with no questions asked, and where the rest
    // of the list lives. Everything else the app explains where it happens.
    // It also only runs once there is something real to point at - see
    // hasContentToShow below.
    var STEPS = [
        {
            id: 'right-now',
            title: 'One thing at a time',
            body: 'The top of your day holds a single thing, never a list. Start it, say it is already done, or push it off. When nothing is waiting, this card says so \u2014 and an empty day here is a finished one, not a failure.',
            target: '#rightNowCard',
            tab: 'home'
        },
        {
            id: 'capture',
            title: 'Park a thought',
            body: 'Type anything into this box and press Enter. It is saved with no date and no colour until you give it one, so nothing you write here can turn into something you are late for.',
            target: '#captureInput',
            tab: 'home'
        },
        {
            id: 'everything',
            title: 'Everything else lives here',
            body: 'The full list, filtered by what needs you, what is ticking along, and what is still parked. New tasks are made here too \u2014 one screen, and only the name is required.',
            target: '.nav-item[data-tab="tasks"]',
            tab: 'tasks',
            final: true
        }
    ];

    var state = {
        active: false,
        index: 0,
        releaseFocus: null,
        overlay: null,
        returnTab: 'home',
        spotlight: null,
        dialog: null,
        reposition: null,
        reason: 'first-run'
    };

    function scopeKey() {
        var scope = (typeof window.storageScope === 'string' && window.storageScope) ||
            (typeof storageScope !== 'undefined' ? storageScope : 'guest');
        return 'bokea_tutorial_done_' + scope;
    }

    function markSeen() {
        try {
            localStorage.setItem(scopeKey(), 'true');
        } catch (e) { /* storage blocked */ }
        // Best-effort mirror to the cloud profile so the tour does not reappear
        // on the user's other devices. Silently ignored if the column or the
        // client is not there.
        try {
            var client = window.supabaseClient || null;
            var uid = localStorage.getItem('bokea_user_id');
            if (client && uid) {
                // A Supabase query is only sent once something waits on it.
                // Without the .then() this update was built and never made,
                // so the tour came back on every other device.
                client.from('profiles').update({ has_completed_tutorial: true }).eq('id', uid)
                    .then(function (res) {
                        if (res && res.error) console.warn('Could not save tutorial progress to the account.', res.error);
                    }, function () { /* offline: the flag on this device still holds */ });
            }
        } catch (e) { /* not fatal */ }
    }

    function reducedMotion() {
        return a11y ? a11y.prefersReducedMotion() : false;
    }

    function esc(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function switchTab(tab) {
        if (!tab) return;
        var nav = document.querySelector('.nav-menu .nav-item[data-tab="' + tab + '"]');
        if (nav && !nav.classList.contains('active')) nav.click();
    }

    function buildChrome() {
        var overlay = document.createElement('div');
        overlay.className = 'tour-overlay';
        overlay.id = 'tourOverlay';

        var spotlight = document.createElement('div');
        spotlight.className = 'tour-spotlight';
        spotlight.setAttribute('aria-hidden', 'true');

        var dialog = document.createElement('div');
        dialog.className = 'tour-dialog';
        dialog.id = 'tourDialog';
        dialog.setAttribute('role', 'dialog');
        dialog.setAttribute('aria-modal', 'true');
        dialog.setAttribute('aria-labelledby', 'tourTitle');
        dialog.setAttribute('aria-describedby', 'tourBody');
        dialog.setAttribute('tabindex', '-1');

        overlay.appendChild(spotlight);
        overlay.appendChild(dialog);
        document.body.appendChild(overlay);

        state.overlay = overlay;
        state.spotlight = spotlight;
        state.dialog = dialog;

        // A click on the dimmed area is a common accidental exit. Treat it as
        // "leave the tour" but only outside the dialog itself.
        overlay.addEventListener('mousedown', function (e) {
            if (e.target === overlay || e.target === spotlight) end('dismissed');
        });

        document.addEventListener('keydown', onKeydown, true);
        window.addEventListener('resize', schedulePosition);
        window.addEventListener('scroll', schedulePosition, true);
    }

    function tearDownChrome() {
        document.removeEventListener('keydown', onKeydown, true);
        window.removeEventListener('resize', schedulePosition);
        window.removeEventListener('scroll', schedulePosition, true);
        if (state.overlay && state.overlay.parentNode) {
            state.overlay.parentNode.removeChild(state.overlay);
        }
        state.overlay = state.spotlight = state.dialog = null;
    }

    function onKeydown(e) {
        if (!state.active) return;
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            end('dismissed');
        } else if (e.key === 'ArrowRight') {
            // Do not hijack arrows while the user is typing in a tour field.
            if (isTextEntry(document.activeElement)) return;
            e.preventDefault();
            go(1);
        } else if (e.key === 'ArrowLeft') {
            if (isTextEntry(document.activeElement)) return;
            e.preventDefault();
            go(-1);
        }
    }

    function isTextEntry(el) {
        if (!el) return false;
        var tag = el.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
    }

    var positionFrame = null;
    function schedulePosition() {
        if (positionFrame) return;
        positionFrame = window.requestAnimationFrame(function () {
            positionFrame = null;
            position();
        });
    }

    function currentTarget() {
        var step = STEPS[state.index];
        if (!step) return null;
        var el = step.target ? document.querySelector(step.target) : null;
        if ((!el || !isVisible(el)) && step.fallbackTarget) {
            el = document.querySelector(step.fallbackTarget);
        }
        return el && isVisible(el) ? el : null;
    }

    function isVisible(el) {
        if (!el) return false;
        if (el.closest('.hidden')) return false;
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function position() {
        if (!state.active || !state.dialog) return;
        var target = currentTarget();
        var pad = 8;

        if (!target) {
            state.spotlight.style.display = 'none';
            state.overlay.classList.add('tour-no-target');
            state.dialog.classList.add('tour-dialog-centred');
            state.dialog.style.top = '';
            state.dialog.style.left = '';
            return;
        }

        var rect = target.getBoundingClientRect();
        state.overlay.classList.remove('tour-no-target');
        state.spotlight.style.display = 'block';
        state.spotlight.style.top = (rect.top - pad) + 'px';
        state.spotlight.style.left = (rect.left - pad) + 'px';
        state.spotlight.style.width = (rect.width + pad * 2) + 'px';
        state.spotlight.style.height = (rect.height + pad * 2) + 'px';

        state.dialog.classList.remove('tour-dialog-centred');
        var dRect = state.dialog.getBoundingClientRect();
        var gap = 16;
        var vw = window.innerWidth;
        var vh = window.innerHeight;

        // Prefer below, then above, then beside; always clamped on screen.
        var top = rect.bottom + gap;
        if (top + dRect.height > vh - gap) {
            top = rect.top - dRect.height - gap;
        }
        if (top < gap) {
            top = Math.max(gap, Math.min(vh - dRect.height - gap, rect.top));
        }

        var left = rect.left;
        if (left + dRect.width > vw - gap) left = vw - dRect.width - gap;
        if (left < gap) left = gap;

        state.dialog.style.top = Math.round(top) + 'px';
        state.dialog.style.left = Math.round(left) + 'px';
    }

    function render() {
        var step = STEPS[state.index];
        var total = STEPS.length;
        var n = state.index + 1;
        var isLast = state.index === total - 1;

        var actions = '';
        if (step.final) {
            // The examples are offered on the first-run card now, before any
            // of this, so the end of the tour has nothing left to sell.
            actions =
                '<button type="button" class="btn btn-secondary tour-btn" data-tour-action="prev">Back</button>' +
                '<button type="button" class="btn btn-primary tour-btn" data-tour-action="finish">Got it</button>';
        } else {
            actions =
                '<button type="button" class="btn btn-secondary tour-btn" data-tour-action="prev"' +
                    (state.index === 0 ? ' disabled' : '') + '>Back</button>' +
                '<button type="button" class="btn btn-primary tour-btn" data-tour-action="next">' +
                    (isLast ? 'Finish' : 'Next') + '</button>';
        }

        state.dialog.innerHTML =
            '<p class="tour-progress" id="tourProgress">Step ' + n + ' of ' + total + '</p>' +
            '<h2 class="tour-title" id="tourTitle">' + esc(step.title) + '</h2>' +
            '<p class="tour-body" id="tourBody">' + esc(step.body) + '</p>' +
            (step.note ? '<p class="tour-note">' + esc(step.note) + '</p>' : '') +
            '<div class="tour-dots" aria-hidden="true">' +
                STEPS.map(function (_, i) {
                    return '<span class="tour-dot' + (i === state.index ? ' is-current' : '') +
                        (i < state.index ? ' is-done' : '') + '"></span>';
                }).join('') +
            '</div>' +
            '<div class="tour-actions">' + actions + '</div>' +
            '<button type="button" class="tour-skip" data-tour-action="skip">Skip the tour</button>';

        state.dialog.querySelectorAll('[data-tour-action]').forEach(function (btn) {
            btn.addEventListener('click', function () {
                handleAction(btn.getAttribute('data-tour-action'));
            });
        });

        switchTab(step.tab);

        var target = currentTarget();
        if (target) {
            target.classList.add('tour-target-active');
            try {
                target.scrollIntoView({
                    behavior: reducedMotion() ? 'auto' : 'smooth',
                    block: 'center',
                    inline: 'nearest'
                });
            } catch (e) {
                target.scrollIntoView();
            }
        }

        // Let the tab switch and scroll settle before measuring.
        window.setTimeout(position, reducedMotion() ? 0 : 220);
        position();

        if (a11y) {
            a11y.announce('Step ' + n + ' of ' + total + '. ' + step.title + '. ' + step.body);
        }
    }

    function clearHighlights() {
        document.querySelectorAll('.tour-target-active').forEach(function (el) {
            el.classList.remove('tour-target-active');
        });
    }

    function handleAction(action) {
        if (action === 'next') {
            go(1);
        } else if (action === 'prev') {
            go(-1);
        } else if (action === 'skip') {
            end('skipped');
        } else if (action === 'finish') {
            end('completed');
        } else if (action === 'create-task') {
            end('completed', false);
            if (typeof window.openCreateTaskModal === 'function') {
                window.openCreateTaskModal();
            }
        } else if (action === 'samples') {
            var btn = state.dialog.querySelector('[data-tour-action="samples"]');
            if (btn) {
                btn.disabled = true;
                btn.textContent = 'Adding…';
            }
            Promise.resolve(typeof window.addSampleTasks === 'function' ? window.addSampleTasks() : null)
                .then(function () {
                    end('completed');
                    if (typeof window.showToast === 'function') {
                        window.showToast('Three example tasks added. Delete them whenever you like.');
                    }
                    if (a11y) a11y.announce('Three example tasks added to your list. You can delete them at any time.');
                })
                .catch(function (err) {
                    console.error('Could not add example tasks', err);
                    end('completed');
                    if (typeof window.showToast === 'function') {
                        window.showToast('Could not add the examples. Your account is unchanged.', 'error');
                    }
                });
        }
    }

    function go(delta) {
        var next = state.index + delta;
        if (next < 0) return;
        if (next >= STEPS.length) {
            end('completed');
            return;
        }
        clearHighlights();
        state.index = next;
        render();
    }

    // A tour of an empty app explains an empty box. If there is nothing in
    // the account yet, the first-run card on Today is doing this job better,
    // and the tour waits until there is something real on the screen.
    function hasContentToShow() {
        var card = document.querySelector('#rightNowCard .right-now-title');
        return !!card;
    }

    function start(options) {
        if (state.active) return;
        var opts = options || {};
        if (opts.reason === 'first-run' && !hasContentToShow()) return;

        // Remember where the person was, because the tour walks through tabs
        // and has to put them back rather than abandoning them on whichever
        // screen the last step happened to describe.
        var current = document.querySelector('.nav-menu .nav-item.active');
        state.returnTab = current ? current.getAttribute('data-tab') : 'home';
        state.active = true;
        state.index = 0;
        state.reason = opts.reason || 'manual';

        buildChrome();
        render();
        state.releaseFocus = a11y
            ? a11y.trapFocus(state.dialog, { initialFocus: '[data-tour-action="next"], [data-tour-action="create-task"]' })
            : null;
        document.body.classList.add('tour-open');
    }

    // `restoreFocus` is skipped when we are handing focus to something else,
    // such as the create-task dialog.
    function end(outcome, restoreFocus) {
        if (!state.active) return;
        state.active = false;
        clearHighlights();
        if (state.releaseFocus) state.releaseFocus(restoreFocus !== false);
        state.releaseFocus = null;
        tearDownChrome();
        document.body.classList.remove('tour-open');
        switchTab(state.returnTab || 'home');

        // Any exit counts as seen. A tutorial that keeps reappearing because you
        // pressed Escape is worse than no tutorial.
        markSeen();

        if (a11y) {
            a11y.announce(outcome === 'completed'
                ? 'Tour finished. You can replay it from Settings.'
                : 'Tour closed. You can replay it from Settings at any time.');
        }
    }

    function reset() {
        try { localStorage.removeItem(scopeKey()); } catch (e) { /* storage blocked */ }
    }

    window.BokeaTour = {
        start: start,
        end: end,
        reset: reset,
        isActive: function () { return state.active; },
        hasSeen: function () {
            try { return localStorage.getItem(scopeKey()) === 'true'; } catch (e) { return false; }
        },
        steps: STEPS
    };
})();
