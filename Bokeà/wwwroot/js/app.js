// Bokeà - Frontend Application

const API_BASE = '/api';
const parseTaskId = id => isNaN(Number(id)) ? id : Number(id);

// Supabase Client Initialization
let supabaseClient = null;
if (window.supabase && window.ENV && typeof window.ENV.isConfigured === 'function' && window.ENV.isConfigured()) {
    try {
        supabaseClient = window.supabase.createClient(window.ENV.SUPABASE_URL, window.ENV.SUPABASE_ANON_KEY);
        console.log("Bokeà: Supabase client initialized.");
    } catch (e) {
        console.warn("Bokeà: Failed to initialize Supabase client.", e);
    }
}

// ---------------------------------------------------------------------------
// localStorage keys
//
// Task and history data is namespaced per account. Two people signing in on the
// same device — or the same person creating a second account — must never see
// each other's tasks, and a fresh account must never inherit whatever the
// previous session left behind.
// ---------------------------------------------------------------------------
const LEGACY_STORAGE_KEYS = { TASKS: 'lifeSorted_tasks', HISTORY: 'lifeSorted_history', PROFILE: 'bokea_profile' };

let storageScope = 'guest';

// Sessions used to be mintable in the browser: the "try it without an account"
// button wrote this token and the app let it in. Nothing issues it any more, and
// the only reason the name survives is to recognise one left on a device from
// before and throw it away rather than honour it. See clearStaleLocalSession().
const LEGACY_OFFLINE_TOKEN = 'offline_mode_token';

// Returns a stable, filesystem-safe id for whoever is currently signed in.
// 'guest' means nobody is: it is the empty bucket the app reads before a session
// exists, never a bucket a session is granted.
function currentStorageScope() {
    const token = localStorage.getItem('bokea_auth_token');
    if (!token || token === LEGACY_OFFLINE_TOKEN) return 'guest';
    const uid = localStorage.getItem('bokea_user_id');
    return uid ? `u_${String(uid).replace(/[^a-zA-Z0-9_-]/g, '')}` : 'guest';
}

function setStorageScope(scope) {
    storageScope = scope || 'guest';
    // Mirrored onto window so onboarding.js (a separate script) can read it.
    window.storageScope = storageScope;
}

function refreshStorageScope() {
    setStorageScope(currentStorageScope());
    migrateLegacyStorage();
    invalidateDayShapeCache();
    return storageScope;
}

// One-time move of pre-namespacing data into the current account, so an existing
// user's real tasks are not orphaned by the upgrade.
let hasMigratedStorage = false;
function migrateLegacyStorage() {
    if (hasMigratedStorage) return;
    hasMigratedStorage = true;
    try {
        const legacyTasks = localStorage.getItem(LEGACY_STORAGE_KEYS.TASKS);
        if (legacyTasks !== null && localStorage.getItem(STORAGE_KEYS.TASKS) === null) {
            localStorage.setItem(STORAGE_KEYS.TASKS, legacyTasks);
        }
        const legacyHistory = localStorage.getItem(LEGACY_STORAGE_KEYS.HISTORY);
        if (legacyHistory !== null && localStorage.getItem(STORAGE_KEYS.HISTORY) === null) {
            localStorage.setItem(STORAGE_KEYS.HISTORY, legacyHistory);
        }
        const legacyProfile = localStorage.getItem(LEGACY_STORAGE_KEYS.PROFILE);
        if (legacyProfile !== null && localStorage.getItem(STORAGE_KEYS.PROFILE) === null) {
            localStorage.setItem(STORAGE_KEYS.PROFILE, legacyProfile);
        }
        localStorage.removeItem(LEGACY_STORAGE_KEYS.TASKS);
        localStorage.removeItem(LEGACY_STORAGE_KEYS.HISTORY);
    } catch (e) {
        /* storage blocked - nothing to migrate */
    }
}

const STORAGE_KEYS = {
    get TASKS() { return `bokea_tasks_${storageScope}`; },
    get HISTORY() { return `bokea_history_${storageScope}`; },
    get PROFILE() { return `bokea_profile_${storageScope}`; }
};

// Global State
let tasks = [];
let historyData = [];
let chartRange = 7; // Days to show in graph
let isFallbackMode = false; // Flag for localStorage fallback

// Lucide Icons initialization helper - batched via microtask to eliminate duplicate full-DOM sweeps
let isRefreshingIcons = false;
function refreshIcons() {
    if (typeof lucide === 'undefined') return;
    if (isRefreshingIcons) return;
    isRefreshingIcons = true;
    queueMicrotask(() => {
        isRefreshingIcons = false;
        try {
            lucide.createIcons();
        } catch (e) {
            console.error("Failed to render icons", e);
        }
    });
}

// 1. LocalStorage store initialization
//
// A new account starts genuinely empty. No sample tasks, no invented completion
// history, no placeholder name — nothing on the screen is anyone's data but the
// person who typed it in. Example tasks exist (see SAMPLE_TASKS below) but are
// only ever written when the user explicitly asks for them during the tutorial.
function initLocalStorage() {
    // Deliberately writes nothing. An account that has never created a task
    // leaves no trace on the device at all, so signing out cannot leave an
    // orphaned store behind for the next person. Readers default to an empty
    // list, which is what "no data" should look like anyway.
    migrateLegacyStorage();
}

function readStore(key) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
        return [];
    }
}

// Opt-in only. Offered once, by name, on the last step of the tutorial, and
// every one of these is flagged isSample so it can be told apart from real work
// (and is never migrated into a cloud account behind the user's back).
const SAMPLE_TASKS = [
    {
        name: 'Drink a glass of water',
        category: 'Health & Vitality',
        description: 'An example task. Delete it whenever you like.',
        type: 'interval',
        intervalDays: 1,
        durationMinutes: 2,
        timeSlot: 'morning'
    },
    {
        name: 'Ten minutes of tidying',
        category: 'Mind & Environment',
        description: 'An example task. Delete it whenever you like.',
        type: 'interval',
        intervalDays: 2,
        durationMinutes: 10,
        timeSlot: 'evening'
    },
    {
        name: 'Message someone you have not spoken to',
        category: 'Relationships & Social',
        description: 'An example task. Delete it whenever you like.',
        type: 'interval',
        intervalDays: 7,
        durationMinutes: 5,
        timeSlot: 'anytime'
    }
];

async function addSampleTasks() {
    const now = new Date().toISOString();
    for (const sample of SAMPLE_TASKS) {
        await apiRequest('/tasks', 'POST', Object.assign({}, sample, {
            createdAt: now,
            lastCompleted: null,
            snoozeUntil: null,
            isSample: true
        }));
    }
    await loadDashboardData();
    // The one moment the app has to prove it did something, it used to stay
    // silent - three tasks appeared in a segment nobody was looking at.
    showToast(`${SAMPLE_TASKS.length} examples added. Delete them whenever you like.`);
}

// Drops a session that no server ever issued. Devices that used the old
// "try it without an account" button still carry one, and it must not be
// mistaken for proof of anything - the account screen is where they go now.
// Whatever that session wrote is left on the device untouched, so signing in
// can still offer to carry it into a real account.
function clearStaleLocalSession() {
    try {
        if (localStorage.getItem('bokea_auth_token') !== LEGACY_OFFLINE_TOKEN) return;
        localStorage.removeItem('bokea_auth_token');
        localStorage.removeItem('bokea_local_account_id');
        localStorage.removeItem('bokea_username');
        localStorage.removeItem('bokea_setup_completed');
    } catch (e) {
        /* storage blocked - there is no session to drop */
    }
}

// Wipes every trace of the signed-in account's data from this device. Used on
// sign-out so the next person to use the browser starts from nothing.
function clearScopedStorage(scope) {
    const target = scope || storageScope;
    try {
        localStorage.removeItem(`bokea_tasks_${target}`);
        localStorage.removeItem(`bokea_history_${target}`);
        localStorage.removeItem(`bokea_profile_${target}`);
        localStorage.removeItem(`bokea_tutorial_done_${target}`);
        localStorage.removeItem(LEGACY_STORAGE_KEYS.TASKS);
        localStorage.removeItem(LEGACY_STORAGE_KEYS.HISTORY);
        localStorage.removeItem(LEGACY_STORAGE_KEYS.PROFILE);
    } catch (e) {
        /* storage blocked */
    }
}

// 2. Dynamic Task State Calculation (Fallback logic / Client-side validator)
function calculateTaskState(task) {
    const now = new Date();
    
    // Check if task has a future snooze date
    if (task.snoozeUntil) {
        const snoozeDate = new Date(task.snoozeUntil);
        if (snoozeDate > now) {
            return 'Green'; // Snoozed tasks are temporarily safe
        }
    }
    
    // Check if task is already completed today
    if (task.lastCompleted) {
        const lastComp = new Date(task.lastCompleted);
        const todayStr = calDateStr(now);
        const lastCompStr = calDateStr(lastComp);
        if (lastCompStr === todayStr) {
            return 'Green'; // Completed today
        }
    }

    if (task.type === 'fixed' || task.intervalType === 'FixedDate') {
        // A fixed task with no date is a parked thought. It has never been
        // scheduled, so it cannot be late, and it is not allowed to carry a
        // colour at all - that is the whole point of parking something.
        if (!task.dueDate) return 'Parked';

        const dueDateStr = (typeof task.dueDate === 'string' ? task.dueDate : (task.dueDate.value || '')).split('T')[0];

        // Check if fixed date task was already completed on or after due date
        if (task.lastCompleted) {
            const lastCompDate = calDateStr(new Date(task.lastCompleted));
            if (lastCompDate >= dueDateStr) {
                return 'Green';
            }
        }

        // Parse deadline using target time if provided, or end of day (23:59:59) so tasks due today aren't red mid-day
        let dueDateTime;
        if (task.dueTime && /^\d{2}:\d{2}$/.test(task.dueTime)) {
            dueDateTime = new Date(`${dueDateStr}T${task.dueTime}:00`);
        } else {
            dueDateTime = new Date(`${dueDateStr}T23:59:59`);
        }

        const diffMs = dueDateTime - now;
        const diffHours = diffMs / (1000 * 60 * 60);

        if (diffHours < 0) {
            // Past the date. Whether that is allowed to be red depends on
            // what kind of thing this is: see isCommitment below.
            return taskIsCommitment(task) ? 'Red' : 'Amber';
        } else if (diffHours <= 24) {
            return 'Amber'; // Due within 24 hours
        } else {
            return 'Green';
        }
    } else {
        // Interval-based.
        //
        // The old maths went amber at 80% of the interval and red at 100%,
        // measured from the last completion, with no grace at all - so an
        // every-two-days task was red 48 hours later, permanently. ADHD
        // consistency is spiky by nature, and a system that turns every gap
        // red within hours converts a good week into a red screen, which is
        // the thing that makes people stop opening the app.
        //
        // So: amber when it comes due, and red only once the grace band has
        // also gone by - and then only for things the user has said are hard
        // commitments. Everything else ages to amber and waits there.
        const interval = parseInt(task.intervalDays) || 1;
        const baseDate = task.lastCompleted ? new Date(task.lastCompleted) : new Date(task.createdAt || now);

        const diffMs = now - baseDate;
        const ratio = (diffMs / (1000 * 60 * 60 * 24)) / interval;

        if (ratio < 0.8) return 'Green';
        if (ratio < 1.0 + taskGraceRatio(task)) return 'Amber';
        return taskIsCommitment(task) ? 'Red' : 'Amber';
    }
}

// How much slack a task gets past its due point before it is called late,
// as a fraction of its own interval. Half again by default: long enough to
// cover a bad day, short enough that a weekly thing does not drift a month.
function taskGraceRatio(task) {
    const n = parseFloat(task && task.graceRatio);
    return (isFinite(n) && n >= 0) ? n : 0.5;
}

// Red is reserved for things the user has explicitly called a commitment -
// the bill, the appointment. Soft habits are the default and never go red.
function taskIsCommitment(task) {
    return !!(task && (task.isCommitment === true || task.isCommitment === 1));
}

function mapBackendTask(task) {
    if (!task) return task;
    if (task.title && !task.name) {
        task.name = task.title;
    }
    if (task.dueDate && typeof task.dueDate === 'object' && task.dueDate.value) {
        task.dueDate = task.dueDate.value.split('T')[0];
    } else if (task.due_date && typeof task.due_date === 'string') {
        task.dueDate = task.due_date.split('T')[0];
    }
    if (task.due_time !== undefined && task.dueTime === undefined) {
        task.dueTime = task.due_time;
    }
    if (task.time_slot !== undefined && task.timeSlot === undefined) {
        task.timeSlot = task.time_slot;
    }
    if (task.duration_minutes !== undefined && task.durationMinutes === undefined) {
        task.durationMinutes = task.duration_minutes;
    }
    if (task.notify_pref !== undefined && task.notifyPref === undefined) {
        task.notifyPref = task.notify_pref;
    }
    if (task.is_archived !== undefined && task.isArchived === undefined) {
        task.isArchived = task.is_archived;
    }
    if (task.is_sample !== undefined && task.isSample === undefined) {
        task.isSample = task.is_sample;
    }
    if (task.is_commitment !== undefined && task.isCommitment === undefined) {
        task.isCommitment = task.is_commitment;
    }
    if (task.sector && !task.category) {
        if (task.sector === 'HealthAndVitality') task.category = 'Health & Vitality';
        else if (task.sector === 'CareerAndFinance') task.category = 'Career & Finance';
        else if (task.sector === 'RelationshipsAndSocial') task.category = 'Relationships & Social';
        else if (task.sector === 'MindAndEnvironment') task.category = 'Mind & Environment';
        else task.category = task.sector;
    }
    if (task.interval_type && !task.type) {
        task.type = task.interval_type === 'IntervalBased' ? 'interval' : 'fixed';
    }
    if (task.interval_days !== undefined && task.intervalDays === undefined) {
        task.intervalDays = task.interval_days;
    }
    if (task.last_completed_at && !task.lastCompleted) {
        task.lastCompleted = task.last_completed_at;
    }
    if (task.snoozed_until && !task.snoozeUntil) {
        task.snoozeUntil = task.snoozed_until;
    }
    return task;
}

// 3. Supabase BaaS Client & API Request Router
async function apiRequest(endpoint, method = 'GET', body = null) {
    // localStorage is a cushion for a server that has gone quiet mid-session
    // (isFallbackMode), not a way to run without one. Reaching here without a
    // client at all means no session was ever granted, so there is nothing to
    // serve from the network either way.
    if (isFallbackMode || !supabaseClient) {
        return handleLocalStorageFallback(endpoint, method, body);
    }

    try {
        // --- Supabase BaaS Endpoints ---

        // GET /tasks
        if (endpoint === '/tasks' && method === 'GET') {
            const { data, error } = await supabaseClient
                .from('tasks')
                .select('*')
                .order('display_order', { ascending: true })
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map(mapBackendTask);
        }

        // POST /tasks
        if (endpoint === '/tasks' && method === 'POST') {
            const { data: userResp } = await supabaseClient.auth.getUser();
            const userId = userResp?.user?.id;
            if (!userId) throw new Error("User not authenticated.");

            const sectorMap = {
                'Health & Vitality': 'HealthAndVitality',
                'Career & Finance': 'CareerAndFinance',
                'Relationships & Social': 'RelationshipsAndSocial',
                'Mind & Environment': 'MindAndEnvironment'
            };
            const sector = sectorMap[body.category] || body.sector || 'HealthAndVitality';
            const intervalType = (body.type === 'interval' || body.intervalType === 'IntervalBased') ? 'IntervalBased' : 'FixedDate';
            const intervalDays = body.intervalDays ? parseInt(body.intervalDays) : null;
            let dueDate = body.dueDate || null;
            if (intervalType === 'IntervalBased' && intervalDays && !dueDate) {
                dueDate = new Date(Date.now() + intervalDays * 86400000).toISOString();
            }

            const newTaskRow = {
                user_id: userId,
                title: body.name || body.title || 'Untitled Task',
                description: body.description || null,
                sector: sector,
                interval_type: intervalType,
                interval_days: intervalDays,
                due_date: dueDate,
                due_time: body.dueTime || null,
                time_slot: body.timeSlot || 'anytime',
                duration_minutes: body.durationMinutes || 15,
                notify_pref: body.notifyPref || 'digest',
                is_archived: false,
                is_sample: body.isSample === true,
                state: 'Green',
                display_order: body.displayOrder || 0
            };

            const { data, error } = await supabaseClient.from('tasks').insert([newTaskRow]).select().single();
            if (error) throw error;
            return mapBackendTask(data);
        }

        // PUT /tasks/{id}
        if (endpoint.startsWith('/tasks/') && method === 'PUT' && !endpoint.includes('/reorder')) {
            const id = parseTaskId(endpoint.split('/')[2]);
            const sectorMap = {
                'Health & Vitality': 'HealthAndVitality',
                'Career & Finance': 'CareerAndFinance',
                'Relationships & Social': 'RelationshipsAndSocial',
                'Mind & Environment': 'MindAndEnvironment'
            };
            const updatePayload = {
                title: body.name || body.title,
                description: body.description || null,
                sector: sectorMap[body.category] || body.sector || 'HealthAndVitality',
                interval_type: (body.type === 'interval' || body.intervalType === 'IntervalBased') ? 'IntervalBased' : 'FixedDate',
                interval_days: body.intervalDays ? parseInt(body.intervalDays) : null
            };
            if (body.dueDate !== undefined) updatePayload.due_date = body.dueDate;
            if (body.dueTime !== undefined) updatePayload.due_time = body.dueTime;
            if (body.timeSlot !== undefined) updatePayload.time_slot = body.timeSlot;
            if (body.durationMinutes !== undefined) updatePayload.duration_minutes = body.durationMinutes;
            if (body.notifyPref !== undefined) updatePayload.notify_pref = body.notifyPref;
            if (body.isArchived !== undefined) updatePayload.is_archived = body.isArchived;

            const { data, error } = await supabaseClient.from('tasks').update(updatePayload).eq('id', id).select().single();
            if (error) throw error;
            return mapBackendTask(data);
        }

        // DELETE /tasks/{id}/complete - undo the most recent completion
        if (endpoint.includes('/complete') && method === 'DELETE') {
            const id = parseTaskId(endpoint.split('/')[2]);
            // Find and delete the newest completion log for this task
            const { data: logs, error: logsErr } = await supabaseClient
                .from('task_completion_logs')
                .select('*')
                .eq('task_id', id)
                .order('completed_at', { ascending: false })
                .limit(2);
            if (logsErr) throw logsErr;

            if (logs && logs.length > 0) {
                await supabaseClient.from('task_completion_logs').delete().eq('id', logs[0].id);
            }

            const prevCompleted = (logs && logs.length > 1) ? logs[1].completed_at : null;

            // Fetch current task to recalculate state/due date
            const { data: currentTask, error: tErr } = await supabaseClient.from('tasks').select('*').eq('id', id).single();
            if (tErr) throw tErr;

            let nextDue = currentTask.due_date;
            if (currentTask.interval_type === 'IntervalBased') {
                const days = currentTask.interval_days || 1;
                if (prevCompleted) {
                    nextDue = new Date(new Date(prevCompleted).getTime() + days * 86400000).toISOString();
                } else {
                    nextDue = currentTask.created_at || new Date().toISOString();
                }
            }

            const { data, error } = await supabaseClient.from('tasks').update({
                last_completed_at: prevCompleted,
                due_date: nextDue,
                snoozed_until: null,
                state: 'Green'
            }).eq('id', id).select().single();
            if (error) throw error;
            return mapBackendTask(data);
        }

        // DELETE /tasks/{id}
        if (endpoint.startsWith('/tasks/') && method === 'DELETE' && !endpoint.includes('/complete')) {
            const id = parseTaskId(endpoint.split('/')[2]);
            const { error } = await supabaseClient.from('tasks').delete().eq('id', id);
            if (error) throw error;
            return null;
        }

        // POST /tasks/{id}/complete
        if (endpoint.includes('/complete') && method === 'POST') {
            const id = parseTaskId(endpoint.split('/')[2]);
            const { data: task, error: fetchErr } = await supabaseClient.from('tasks').select('*').eq('id', id).single();
            if (fetchErr) throw fetchErr;

            const now = new Date();
            const nowIso = now.toISOString();
            let nextDue = task.due_date;
            if (task.interval_type === 'IntervalBased') {
                const days = task.interval_days || 1;
                nextDue = new Date(now.getTime() + days * 86400000).toISOString();
            }

            // Log completion
            const { data: userResp } = await supabaseClient.auth.getUser();
            await supabaseClient.from('task_completion_logs').insert([{
                task_id: id,
                user_id: userResp?.user?.id,
                completed_at: nowIso,
                notes: body?.notes || null
            }]);

            // Update task
            const { data, error } = await supabaseClient.from('tasks').update({
                last_completed_at: nowIso,
                due_date: nextDue,
                snoozed_until: null,
                state: 'Green'
            }).eq('id', id).select().single();
            if (error) throw error;
            return mapBackendTask(data);
        }

        // POST /tasks/{id}/snooze
        if (endpoint.includes('/snooze') && method === 'POST') {
            const id = parseTaskId(endpoint.split('/')[2]);
            const asked = body && body.durationHours;
            const durationHours = (asked === 0)
                ? 0
                : (asked || parseInt(localStorage.getItem('bokea_default_snooze')) || 24);

            let snoozeUntil = null;
            if (durationHours > 0) {
                snoozeUntil = new Date(Date.now() + durationHours * 3600000).toISOString();
            }

            const { data, error } = await supabaseClient.from('tasks').update({
                snoozed_until: snoozeUntil,
                state: 'Green'
            }).eq('id', id).select().single();
            if (error) throw error;
            return mapBackendTask(data);
        }

        // GET /digest
        if (endpoint === '/digest' && method === 'GET') {
            const { data: allTasks, error } = await supabaseClient.from('tasks').select('*');
            if (error) throw error;
            const mapped = (allTasks || []).map(mapBackendTask);
            const warnings = mapped.filter(t => {
                const state = calculateTaskState(t);
                return state === 'Red' || state === 'Amber';
            });
            const tasksBySector = {};
            const recommendedActions = [];
            warnings.forEach(t => {
                if (!tasksBySector[t.category]) tasksBySector[t.category] = [];
                tasksBySector[t.category].push({
                    id: t.id,
                    name: t.name,
                    category: t.category,
                    state: calculateTaskState(t),
                    description: t.description,
                    type: t.type,
                    dueDate: t.dueDate,
                    intervalDays: t.intervalDays
                });
                recommendedActions.push(`${t.name} - requires attention. Complete or Snooze?`);
            });
            return {
                totalWarningTasks: warnings.length,
                tasksBySector,
                recommendedActions
            };
        }

        // GET /history or GET /tasks/history
        if ((endpoint === '/history' || endpoint === '/tasks/history') && method === 'GET') {
            const { data: allTasks } = await supabaseClient.from('tasks').select('*');
            const { data: allLogs } = await supabaseClient.from('task_completion_logs').select('*');
            const mappedTasks = (allTasks || []).map(mapBackendTask);
            const logs = allLogs || [];
            const historyList = [];
            const now = new Date();
            for (let i = 29; i >= 0; i--) {
                const target = new Date(now.getTime() - i * 86400000);
                const targetStr = target.toISOString().split('T')[0];
                const completed = logs.filter(l => (l.completed_at || '').startsWith(targetStr)).length;
                let expectedDue = 0;
                mappedTasks.forEach(t => {
                    if (t.type === 'interval' || t.interval_type === 'IntervalBased') {
                        expectedDue += 1.0 / (t.intervalDays || t.interval_days || 1);
                    } else if (t.dueDate === targetStr) {
                        expectedDue += 1.0;
                    }
                });
                let total = Math.round(expectedDue);
                if (total < completed) total = completed;
                if (total === 0) total = 1;
                const rate = Math.min(100, Math.round((completed / total) * 100));
                historyList.push({ date: targetStr, completed, total, rate });
            }
            return historyList;
        }

        // POST /auth/setup
        if (endpoint === '/auth/setup' && method === 'POST') {
            const { data: userResp } = await supabaseClient.auth.getUser();
            const userId = userResp?.user?.id;
            if (userId) {
                await supabaseClient.from('profiles').update({
                    wake_up_time: body.wakeUpTime,
                    bed_time: body.bedTime,
                    work_start_time: body.workStartTime,
                    work_end_time: body.workEndTime,
                    work_days: body.workDays,
                    is_setup_completed: true
                }).eq('id', userId);
            }
            return { success: true };
        }

        // PUT /auth/profile
        if (endpoint === '/auth/profile' && method === 'PUT') {
            const { data: userResp } = await supabaseClient.auth.getUser();
            const userId = userResp?.user?.id;
            if (userId) {
                await supabaseClient.from('profiles').update({
                    wake_up_time: body.wakeUpTime,
                    bed_time: body.bedTime,
                    work_start_time: body.workStartTime,
                    work_end_time: body.workEndTime,
                    work_days: body.workDays,
                    is_setup_completed: true
                }).eq('id', userId);
            }
            return { success: true };
        }

        // GET /auth/profile/about
        //
        // Kept separate from /auth/profile because the two are edited on
        // different screens: Settings owns the schedule, this owns the person.
        // Saving one must never blank the other.
        if (endpoint === '/auth/profile/about' && method === 'GET') {
            const { data: userResp } = await supabaseClient.auth.getUser();
            const userId = userResp?.user?.id;
            if (userId) {
                const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
                return {
                    firstName: profile?.first_name || '',
                    displayName: profile?.display_name || '',
                    pronouns: profile?.pronouns || '',
                    dateOfBirth: profile?.date_of_birth || '',
                    gender: profile?.gender || '',
                    bio: profile?.bio || '',
                    country: profile?.country || '',
                    city: profile?.city || '',
                    timeZoneName: profile?.time_zone || '',
                    phoneNumber: profile?.phone_number || '',
                    avatarDataUrl: profile?.avatar_data_url || '',
                    email: userResp.user.email || ''
                };
            }
        }

        // PUT /auth/profile/about
        if (endpoint === '/auth/profile/about' && method === 'PUT') {
            const { data: userResp } = await supabaseClient.auth.getUser();
            const userId = userResp?.user?.id;
            if (userId) {
                const row = {};
                // Only fields the caller actually sent are written. An empty
                // string is a deliberate clearing and goes through as null; an
                // absent key is left alone.
                const map = {
                    firstName: 'first_name',
                    displayName: 'display_name',
                    pronouns: 'pronouns',
                    dateOfBirth: 'date_of_birth',
                    gender: 'gender',
                    bio: 'bio',
                    country: 'country',
                    city: 'city',
                    timeZoneName: 'time_zone',
                    phoneNumber: 'phone_number',
                    avatarDataUrl: 'avatar_data_url'
                };
                Object.keys(map).forEach(key => {
                    if (body[key] === undefined) return;
                    const value = typeof body[key] === 'string' ? body[key].trim() : body[key];
                    row[map[key]] = value === '' ? null : value;
                });
                // first_name is the one field the rest of the app reads, so it
                // is never nulled: a blank name field means "leave it".
                if (row.first_name === null) delete row.first_name;
                if (Object.keys(row).length) {
                    const { error } = await supabaseClient.from('profiles').update(row).eq('id', userId);
                    if (error) throw error;
                }
            }
            return { success: true };
        }

        // POST /push/subscribe
        if (endpoint === '/push/subscribe' && method === 'POST') {
            const { data: userResp } = await supabaseClient.auth.getUser();
            const userId = userResp?.user?.id;
            if (userId && body.endpoint) {
                await supabaseClient.from('push_subscriptions').upsert({
                    user_id: userId,
                    endpoint: body.endpoint,
                    p256dh: body.keys?.p256dh || '',
                    auth: body.keys?.auth || ''
                }, { onConflict: 'endpoint' });
            }
            return { success: true };
        }

        // POST /push/unsubscribe
        if (endpoint === '/push/unsubscribe' && method === 'POST') {
            if (body.endpoint) {
                await supabaseClient.from('push_subscriptions').delete().eq('endpoint', body.endpoint);
            }
            return { success: true };
        }

        // GET /push/vapid-public-key
        if (endpoint === '/push/vapid-public-key' && method === 'GET') {
            return { publicKey: window.ENV?.VAPID_PUBLIC_KEY || '' };
        }

        // Default fallback to LocalStorage
        return handleLocalStorageFallback(endpoint, method, body);
    } catch (err) {
        console.warn(`Supabase operation failed for ${method} ${endpoint}. Falling back to localStorage.`, err);
        isFallbackMode = true;
        showToast("Operating in local offline storage mode.", "warning");
        return handleLocalStorageFallback(endpoint, method, body);
    }
}

// The profile as stored on this device. Also the shape the profile screen
// renders from, so a page load paints immediately instead of waiting on a
// network round trip that may never come back.
const PROFILE_BLANK = {
    firstName: '', lastName: '', displayName: '', pronouns: '', dateOfBirth: '',
    gender: '', bio: '', country: '', city: '', timeZoneName: '', phoneNumber: '',
    avatarDataUrl: '', email: ''
};

function readLocalProfile() {
    let stored = {};
    try {
        stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.PROFILE) || localStorage.getItem('bokea_profile') || '{}') || {};
    } catch (e) {
        // A corrupted blob is not worth a broken screen. Start from empty.
        stored = {};
    }
    const profile = Object.assign({}, PROFILE_BLANK, stored);
    // bokea_username is the name the rest of the app greets you by, and it was
    // here long before this screen existed. It stays the single source of truth
    // for the first name rather than being duplicated and allowed to drift.
    profile.firstName = localStorage.getItem('bokea_username') || profile.firstName || '';
    return profile;
}

// LocalStorage mock router matching the API endpoints
function handleLocalStorageFallback(endpoint, method, body) {
    initLocalStorage();
    
    const localTasks = readStore(STORAGE_KEYS.TASKS);
    const localHistory = readStore(STORAGE_KEYS.HISTORY);

    // GET /auth/profile/about - the profile as this device knows it.
    if (endpoint === '/auth/profile/about' && method === 'GET') {
        return readLocalProfile();
    }

    // PUT /auth/profile/about - merge, never replace. The profile screen saves
    // one field at a time, so a save carrying only "city" must not erase a
    // birthday that was typed a minute earlier.
    if (endpoint === '/auth/profile/about' && method === 'PUT') {
        const merged = Object.assign(readLocalProfile(), body || {});
        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(merged));
        return { success: true };
    }
    
    // GET /tasks
    if (endpoint === '/tasks' && method === 'GET') {
        return localTasks;
    }
    
    // GET /digest
    if (endpoint === '/digest' && method === 'GET') {
        const warnings = localTasks.filter(t => {
            const state = calculateTaskState(t);
            return state === 'Red' || state === 'Amber';
        }).map(t => ({
            id: t.id,
            name: t.name,
            category: t.category,
            state: calculateTaskState(t),
            description: t.description,
            type: t.type,
            dueDate: t.dueDate,
            intervalDays: t.intervalDays
        }));
        
        return {
            redCount: warnings.filter(w => w.state === 'Red').length,
            amberCount: warnings.filter(w => w.state === 'Amber').length,
            tasks: warnings
        };
    }
    
    // POST /tasks/:id/complete
    let match = endpoint.match(/^\/tasks\/(.+)\/complete$/);
    if (match && method === 'POST') {
        const taskId = match[1];
        const idx = localTasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            // Keep what this overwrote so the undo below has something to
            // put back. Offline has no completion log to rewind, so the
            // previous values travel with the task itself.
            localTasks[idx]._undo = {
                lastCompleted: localTasks[idx].lastCompleted || null,
                snoozeUntil: localTasks[idx].snoozeUntil || null
            };
            localTasks[idx].lastCompleted = new Date().toISOString();
            localTasks[idx].snoozeUntil = null;
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(localTasks));

            updateLocalHistory();
            return { success: true, task: localTasks[idx] };
        }
        throw new Error("Task not found");
    }

    // DELETE /tasks/:id/complete - undo the most recent completion.
    // Must sit above the generic DELETE /tasks/:id below, whose pattern would
    // otherwise swallow this path and delete the whole task instead.
    match = endpoint.match(/^\/tasks\/(.+)\/complete$/);
    if (match && method === 'DELETE') {
        const taskId = match[1];
        const idx = localTasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            const prev = localTasks[idx]._undo || {};
            localTasks[idx].lastCompleted = prev.lastCompleted || null;
            localTasks[idx].snoozeUntil = prev.snoozeUntil || null;
            delete localTasks[idx]._undo;
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(localTasks));

            updateLocalHistory();
            return { success: true, task: localTasks[idx] };
        }
        throw new Error("Task not found");
    }
    
    // POST /tasks/:id/snooze
    match = endpoint.match(/^\/tasks\/(.+)\/snooze$/);
    if (match && method === 'POST') {
        const taskId = match[1];
        const idx = localTasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            const asked = body && body.durationHours;
            const durationHours = (asked === 0)
                ? 0
                : (asked || parseInt(localStorage.getItem('bokea_default_snooze')) || 24);
            if (durationHours <= 0) {
                localTasks[idx].snoozeUntil = null;
            } else {
                const snoozeDate = new Date();
                snoozeDate.setHours(snoozeDate.getHours() + durationHours);
                localTasks[idx].snoozeUntil = snoozeDate.toISOString();
            }
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(localTasks));
            
            return { success: true, task: localTasks[idx] };
        }
        throw new Error("Task not found");
    }
    
    // POST /tasks
    if (endpoint === '/tasks' && method === 'POST') {
        const newTask = {
            id: 'task_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            name: body.name,
            category: body.category,
            description: body.description || '',
            type: body.type,
            intervalDays: body.type === 'interval' ? parseInt(body.intervalDays) || 1 : null,
            dueDate: body.type === 'fixed' ? (body.dueDate || null) : null,
            dueTime: body.dueTime || null,
            timeSlot: body.timeSlot || 'anytime',
            durationMinutes: body.durationMinutes || 15,
            isCommitment: body.isCommitment === true,
            notifyPref: body.notifyPref || 'digest',
            isArchived: false,
            isSample: body.isSample === true,
            createdAt: body.createdAt || new Date().toISOString(),
            lastCompleted: null,
            snoozeUntil: null
        };
        localTasks.push(newTask);
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(localTasks));
        
        updateLocalHistory();
        return newTask;
    }
    
    // PUT /tasks/:id
    match = endpoint.match(/^\/tasks\/(.+)$/);
    if (match && method === 'PUT') {
        const taskId = match[1];
        const idx = localTasks.findIndex(t => t.id === taskId);
        if (idx !== -1) {
            localTasks[idx].name = body.name;
            localTasks[idx].category = body.category;
            localTasks[idx].description = body.description || '';
            localTasks[idx].type = body.type;
            localTasks[idx].intervalDays = body.type === 'interval' ? parseInt(body.intervalDays) || 1 : null;
            localTasks[idx].dueDate = body.type === 'fixed' ? body.dueDate : null;
            if (body.dueTime !== undefined) localTasks[idx].dueTime = body.dueTime;
            if (body.timeSlot !== undefined) localTasks[idx].timeSlot = body.timeSlot;
            if (body.durationMinutes !== undefined) localTasks[idx].durationMinutes = body.durationMinutes;
            if (body.isCommitment !== undefined) localTasks[idx].isCommitment = body.isCommitment === true;
            if (body.notifyPref !== undefined) localTasks[idx].notifyPref = body.notifyPref;
            if (body.isArchived !== undefined) localTasks[idx].isArchived = body.isArchived;
            
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(localTasks));
            updateLocalHistory();
            return localTasks[idx];
        }
        throw new Error("Task not found");
    }
    
    // DELETE /tasks/:id
    match = endpoint.match(/^\/tasks\/(.+)$/);
    if (match && method === 'DELETE') {
        const taskId = match[1];
        const filtered = localTasks.filter(t => t.id !== taskId);
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(filtered));
        
        updateLocalHistory();
        return { success: true };
    }
    
    // GET /history or /tasks/history
    if ((endpoint === '/history' || endpoint === '/tasks/history') && method === 'GET') {
        return localHistory;
    }
    
    // POST /auth/setup fallback
    if (endpoint === '/auth/setup' && method === 'POST') {
        return { success: true };
    }

    // PUT /auth/profile fallback - save schedule settings in local storage
    if (endpoint === '/auth/profile' && method === 'PUT') {
        if (body) {
            if (body.wakeUpTime) localStorage.setItem('bokea_wakeup_time', body.wakeUpTime);
            if (body.bedTime) localStorage.setItem('bokea_bed_time', body.bedTime);
            if (body.workStartTime) localStorage.setItem('bokea_work_start', body.workStartTime);
            if (body.workEndTime) localStorage.setItem('bokea_work_end', body.workEndTime);
            if (body.workDays) localStorage.setItem('bokea_work_days', JSON.stringify(body.workDays));
        }
        return { success: true };
    }
    
    throw new Error(`Unsupported fallback endpoint: ${method} ${endpoint}`);
}

// Update the dynamic history metrics in local storage
function updateLocalHistory() {
    initLocalStorage();
    const localTasks = readStore(STORAGE_KEYS.TASKS);
    const localHistory = readStore(STORAGE_KEYS.HISTORY);
    
    const todayStr = calDateStr(new Date());
    
    const completedToday = localTasks.filter(t => {
        if (!t.lastCompleted) return false;
        return calDateStr(new Date(t.lastCompleted)) === todayStr;
    }).length;
    
    const amberRedCount = localTasks.filter(t => {
        const state = calculateTaskState(t);
        return state === 'Red' || state === 'Amber';
    }).length;
    
    const totalDue = completedToday + amberRedCount;
    
    let todayLogIdx = localHistory.findIndex(h => h.date === todayStr);
    const newLog = {
        date: todayStr,
        completed: completedToday,
        total: totalDue || 1,
        rate: Math.round((completedToday / (totalDue || 1)) * 100)
    };
    
    if (todayLogIdx !== -1) {
        localHistory[todayLogIdx] = newLog;
    } else {
        localHistory.push(newLog);
    }
    
    if (localHistory.length > 30) {
        localHistory.shift();
    }
    
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(localHistory));
}

// 4. Data Loading and Screen Rendering Functions

function renderNotifications() {
    const listContainer = document.getElementById('notificationList');
    const badge = document.getElementById('notificationBadge');
    if (!listContainer || !badge) return;

    // Filter tasks that are Red or Amber
    const warningTasks = tasks.filter(t => {
        const state = t.state || calculateTaskState(t);
        return state === 'Red' || state === 'Amber';
    });

    const count = warningTasks.length;
    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('hidden');
        listContainer.innerHTML = '';
        warningTasks.forEach(task => {
            const state = task.state || calculateTaskState(task);
            const stateLower = state.toLowerCase();
            const noteItem = document.createElement('a');
            noteItem.href = '#';
            noteItem.className = 'notification-item';
            noteItem.innerHTML = `
                <span class="dot dot-${stateLower}" style="margin-top: 4px; flex-shrink: 0;"></span>
                <div class="notification-item-text">
                    <span class="notification-item-title" style="font-weight: 600;">${task.name}</span>
                    <span class="notification-item-desc">Overdue: Action required (${state} status)</span>
                </div>
            `;
            noteItem.addEventListener('click', (e) => {
                e.preventDefault();
                document.getElementById('notificationMenuBox').classList.remove('show');
                openEditTaskModal(task.id);
            });
            listContainer.appendChild(noteItem);
        });
    } else {
        badge.classList.add('hidden');
        listContainer.innerHTML = `<div class="notification-empty">No notifications</div>`;
    }
}

async function loadDashboardData() {
    try {
        // Fetch tasks and history in parallel to eliminate sequential waterfall
        const [tasksData, historyLogs] = await Promise.all([
            apiRequest('/tasks', 'GET'),
            apiRequest('/history', 'GET').catch(() => apiRequest('/tasks/history', 'GET'))
        ]);

        tasks = tasksData || [];
        historyData = historyLogs || [];
        
        // Calculate states client-side if the API tasks list items don't have a state field
        const durations = JSON.parse(localStorage.getItem('bokea_task_durations') || '{}');
        tasks.forEach(t => {
            if (durations[t.id]) {
                t.durationMinutes = durations[t.id];
            }
            if (!t.state) {
                t.state = calculateTaskState(t);
            }
        });
        
        // Render active panels
        renderStats();
        renderAnalyticsFinding();
        renderNotifications();
        renderNextUpTask();
        renderDailyScheduleTimeline();
        renderAllTasksGrid();
        // Keep the month in step when the calendar is the visible tab.
        if (!document.getElementById('calendarFullView')?.classList.contains('hidden')) {
            renderCalendar();
        }
    } catch (err) {
        console.error("Critical error loading dashboard data.", err);
    }
}

// Stats panel rendering
function renderStats() {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // 1. Done Today
    const completedCount = tasks.filter(t => {
        if (!t.lastCompleted) return false;
        const compDateStr = new Date(t.lastCompleted).toISOString().split('T')[0];
        return compDateStr === todayStr;
    }).length;
    document.getElementById('statsCompletedToday').textContent = completedCount;
    
    // 2. Current Streak - counts consecutive days where EVERY due task was completed (rate === 100),
    // not just days with any activity. A day with an unfinished goal breaks the streak.
    let streak = 0;
    if (historyData && historyData.length > 0) {
        const sorted = [...historyData].sort((a, b) => new Date(b.date) - new Date(a.date));

        const isFullyComplete = (log) => !!log && log.rate >= 100;

        let checkDate = new Date();
        const todayLog = sorted.find(h => h.date === todayStr);
        if (!isFullyComplete(todayLog)) {
            // Today isn't finished yet (or has nothing logged) - start counting from yesterday
            // so an in-progress day doesn't prematurely reset the streak.
            checkDate.setDate(checkDate.getDate() - 1);
        }

        while (true) {
            const dateStr = checkDate.toISOString().split('T')[0];
            const log = sorted.find(h => h.date === dateStr);
            if (isFullyComplete(log)) {
                streak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }
    }
    document.getElementById('statsStreak').textContent = `${streak}d`;

    // Track the best streak ever seen so it survives beyond the rolling history window.
    const longestStreakKey = 'bokea_longest_streak';
    const longestStreak = Math.max(streak, parseInt(localStorage.getItem(longestStreakKey)) || 0);
    localStorage.setItem(longestStreakKey, longestStreak);
    const streakCard = document.querySelector('.stat-card.streak');
    if (streakCard) {
        streakCard.title = `Best streak: ${longestStreak} day${longestStreak === 1 ? '' : 's'} of completing every goal`;
    }
    
    // 3. Compliance Rate (average compliance of the visible graph range)
    let avgComp = 0;
    if (historyData && historyData.length > 0) {
        const sorted = [...historyData].sort((a, b) => new Date(b.date) - new Date(a.date));
        const slice = sorted.slice(0, chartRange);
        const sum = slice.reduce((acc, h) => acc + h.rate, 0);
        avgComp = Math.round(sum / (slice.length || 1));
    }
    document.getElementById('statsRate').textContent = `${avgComp}%`;
}


// Render "Next Up" Task Widget
// ============================================================
// TODAY — Right Now, After that, Waiting on you
// Rule 1: one thing is asked of you at a time. Everything else on
// this screen is smaller, greyer, or folded away.
// ============================================================
function renderNextUpTask() {
    const todayStr = new Date().toISOString().split('T')[0];

    const decorated = (Array.isArray(tasks) ? tasks : [])
        .filter(t => {
            if (t.lastCompleted) {
                const done = new Date(t.lastCompleted).toISOString().split('T')[0];
                if (done === todayStr) return false;
            }
            if (t.snoozeUntil && new Date(t.snoozeUntil) > new Date()) return false;
            return true;
        })
        .map(t => Object.assign({}, t, { _calculatedState: t.state || calculateTaskState(t) }));

    // Parked thoughts are not part of the day. They have no date, they cannot
    // be late, and they belong in their own tray rather than in the queue.
    const parked = decorated.filter(t => t._calculatedState === 'Parked');
    const open = decorated.filter(t => t._calculatedState !== 'Parked');

    const shape = dayShape();
    const mins = nowMinutes();

    // --------------------------------------------------------------
    // What is allowed to be "right now".
    //
    // This card is named after the clock, so the clock has to be able to
    // veto it. Something urgent qualifies whenever it is. Something with no
    // urgency at all qualifies only while the part of the day it belongs to
    // is actually happening - otherwise the app spends the afternoon
    // recommending a morning task that nothing is asking for, and a card
    // that is visibly wrong twice is a card nobody reads again.
    // --------------------------------------------------------------
    const isActionableNow = (t) => {
        if (t._calculatedState === 'Red' || t._calculatedState === 'Amber') return true;
        const w = taskWhen(t, shape);
        if (w.slot === 'anytime') return false;
        return mins >= w.from && mins < w.to;
    };

    const rank = (st) => (st === 'Red' ? 1 : st === 'Amber' ? 2 : 3);
    const baseDay = (t) => {
        const d = t.type === 'fixed'
            ? new Date(t.dueDate || 0)
            : new Date(t.lastCompleted || t.createdAt || Date.now());
        if (t.type !== 'fixed') d.setDate(d.getDate() + (parseInt(t.intervalDays) || 1));
        d.setHours(0, 0, 0, 0);
        return d.getTime();
    };

    // Time of day now sorts before the due day rather than after it. Among
    // things that are equally urgent, the one whose hour is closest is the
    // one to offer; the calendar only breaks the ties the clock cannot.
    open.sort((x, y) =>
        (rank(x._calculatedState) - rank(y._calculatedState)) ||
        (taskWhen(x, shape).sortKey - taskWhen(y, shape).sortKey) ||
        (baseDay(x) - baseDay(y)));

    const eligible = open.filter(isActionableNow);

    if (eligible.length > 0) {
        const chosen = eligible[0];
        renderRightNow(chosen);
        renderAfterThat(open.filter(t => t !== chosen).slice(0, 2));
    } else {
        // Nothing qualifies. Say so, and say when something will, rather than
        // promoting an arbitrary green task to hero status and putting a
        // "Done" button under it.
        renderRightNow(null, nextWindowLabel(open, shape, mins));
        renderAfterThat(open.slice(0, 2));
    }

    renderWaiting(open.filter(t => t._calculatedState === 'Red' || t._calculatedState === 'Amber'));
    renderParked(parked);
    renderFirstRun();
    renderNavCount(open);
    renderMomentum();
}

// The name of the next part of the day that has something waiting in it, so
// an empty card can say "nothing until this evening" instead of just "nothing".
function nextWindowLabel(open, shape, mins) {
    let best = null;
    (open || []).forEach(t => {
        const w = taskWhen(t, shape);
        if (w.slot === 'anytime') return;
        if (w.from <= mins) return;
        if (!best || w.from < best.from) best = w;
    });
    if (!best) return null;
    return { label: best.label.toLowerCase(), at: fmtHM(best.from) };
}

// Parked thoughts: everything the capture bar took in and nobody has
// scheduled yet. One row, one action - give it a day. That is the "sort it
// out later" the capture placeholder promises, and until it is taken the
// item stays colourless and silent.
function renderParked(list) {
    const fold = document.getElementById('parkedTray');
    const body = document.getElementById('parkedTrayBody');
    const count = document.getElementById('parkedTrayCount');
    if (!fold || !body) return;

    fold.classList.toggle('hidden', !list || list.length === 0);
    if (!list || list.length === 0) { body.innerHTML = ''; return; }

    if (count) count.textContent = list.length === 1 ? '1 thought' : `${list.length} thoughts`;

    body.innerHTML = list.map(t => `
        <div class="parked-row" data-task-id="${esc(String(t.id))}">
            <span class="parked-row-name">${esc(t.name)}</span>
            <span class="parked-row-actions">
                <button type="button" class="btn btn-secondary" onclick="scheduleParked('${esc(String(t.id))}', 'today')">Today</button>
                <button type="button" class="btn btn-secondary" onclick="scheduleParked('${esc(String(t.id))}', 'tomorrow')">Tomorrow</button>
                <button type="button" class="btn btn-secondary" onclick="openEditTaskModal('${esc(String(t.id))}')" title="Pick a day">Pick a day</button>
                <button type="button" class="btn btn-secondary parked-row-bin" onclick="deleteTask('${esc(String(t.id))}')" title="Delete">
                    <i data-lucide="trash-2"></i><span class="sr-only">Delete</span>
                </button>
            </span>
        </div>
    `).join('');
    refreshIcons();
}

// Give a parked thought a day, which is the one decision that turns it into
// a task. Nothing else about it changes.
async function scheduleParked(id, when) {
    const task = (Array.isArray(tasks) ? tasks : []).find(t => String(t.id) === String(id));
    if (!task) return;

    const d = new Date();
    if (when === 'tomorrow') d.setDate(d.getDate() + 1);
    const dueDate = calDateStr(d);

    try {
        await apiRequest(`/tasks/${id}`, 'PUT', {
            name: task.name,
            category: task.category,
            description: task.description || '',
            type: 'fixed',
            dueDate: dueDate,
            dueTime: task.dueTime || null,
            timeSlot: task.timeSlot || 'anytime',
            durationMinutes: taskMinutes(task),
            isCommitment: !!task.isCommitment
        });
        showToast(when === 'tomorrow' ? 'Moved to tomorrow.' : 'On today.');
        await loadDashboardData();
    } catch (err) {
        console.error('Could not schedule parked task:', err);
        showToast('Could not move that.', 'error');
    }
}

function renderRightNow(task, nextWindow) {
    const card = document.getElementById('rightNowCard');
    if (!card) return;

    if (!task) {
        // "Nothing" on its own reads as a dead end. Saying when the day picks
        // up again turns it into a fact about the day rather than a blank.
        const line = nextWindow
            ? `Nothing needs you until this ${esc(nextWindow.label)}.`
            : 'Nothing is waiting on you.';
        const sub = nextWindow
            ? `The next thing opens up around ${esc(nextWindow.at)}.`
            : 'That is a finished day, not an empty one.';
        card.innerHTML = `
            <div class="right-now-rail state-green"></div>
            <div class="right-now-body">
                <div class="right-now-empty">
                    <i data-lucide="check-circle-2"></i>
                    <p>${line}</p>
                    <small>${sub}</small>
                </div>
            </div>
        `;
        refreshIcons();
        return;
    }

    const meta = stateMeta(task._calculatedState);
    const area = areaMeta(task.category);
    const mins = taskMinutes(task);
    const when = taskWhen(task);
    const why = task.description ? esc(task.description) : esc(whyLine(task, meta, mins, when));

    card.innerHTML = `
        <div class="right-now-rail ${meta.cls}"></div>
        <div class="right-now-body">
            <div class="right-now-top">
                <div style="display: flex; flex-direction: column; gap: 10px; min-width: 0;">
                    <div class="right-now-eyebrow">
                        <span>Right now</span>
                        <span class="dot"></span>
                        <span class="right-now-area"><i data-lucide="${area.icon}"></i>${esc(task.category || '')}</span>
                        <span class="dot"></span>
                        <span class="right-now-when${whenIsNow(task, calDateStr(new Date())) ? ' is-now' : ''}" title="${esc(when.range)}"><i data-lucide="${when.icon}"></i>${esc(when.short)}</span>
                    </div>
                    <h1 class="right-now-title">${esc(task.name)}</h1>
                    <p class="right-now-why">${why}</p>
                </div>
                <div class="right-now-side">
                    <span class="state-pill ${meta.cls}"><i data-lucide="${meta.icon}"></i>${meta.word}</span>
                    <span class="right-now-mins"><b>${mins}</b><span>min</span></span>
                </div>
            </div>
            <div class="right-now-actions">
                <button class="btn btn-primary" onclick="startFocus('${task.id}')">
                    <i data-lucide="play"></i><span>Start &mdash; ${mins} min</span>
                </button>
                <button class="btn btn-secondary" onclick="completeTask('${task.id}')">
                    <i data-lucide="check"></i><span>Already done</span>
                </button>
                <button class="btn btn-secondary" onclick="openSnoozeMenu('${task.id}', this)">
                    <i data-lucide="clock"></i><span>Not now</span>
                </button>
                <button class="btn btn-secondary" onclick="openEditTaskModal('${task.id}')">
                    <i data-lucide="edit-2"></i><span>Edit</span>
                </button>
            </div>
        </div>
    `;
    refreshIcons();
}

function renderAfterThat(list) {
    const grid = document.getElementById('afterGrid');
    const section = document.getElementById('afterSection');
    if (!grid) return;

    if (!list || list.length === 0) {
        if (section) section.classList.add('hidden');
        grid.innerHTML = '';
        return;
    }
    if (section) section.classList.remove('hidden');

    // This line used to be a static "Nothing to decide yet" sitting directly
    // above a list of things to decide. Nothing ever wrote it, so it was
    // false whenever it was visible.
    const note = document.getElementById('afterSectionNote');
    if (note) {
        note.textContent = list.length === 1 ? 'One more after this' : `${list.length} more after this`;
    }

    grid.innerHTML = list.map(t => {
        const meta = stateMeta(t._calculatedState);
        return `
            <div class="after-row">
                <span class="after-row-dot ${meta.cls}"></span>
                <span class="after-row-main">
                    <span class="after-row-name">${esc(t.name)}</span>
                    <span class="after-row-when">${esc(taskWhen(t).short)} &middot; ${esc(cadenceText(t))}</span>
                </span>
                <span class="after-row-mins">${taskMinutes(t)} min</span>
            </div>
        `;
    }).join('');
    refreshIcons();
}

function renderWaiting(list) {
    const body = document.getElementById('waitingFoldBody');
    const fold = document.getElementById('waitingFold');
    const redEl = document.getElementById('waitingTallyRed');
    const amberEl = document.getElementById('waitingTallyAmber');
    const labelEl = document.getElementById('waitingFoldLabel');
    if (!body || !fold) return;

    const red = list.filter(t => t._calculatedState === 'Red').length;
    const amber = list.filter(t => t._calculatedState === 'Amber').length;

    if (redEl) {
        redEl.classList.toggle('hidden', red === 0);
        const t = redEl.querySelector('span:last-child');
        if (t) t.textContent = `${red} ${uiPrefs.gentle ? 'waiting' : 'late'}`;
    }
    if (amberEl) {
        amberEl.classList.toggle('hidden', amber === 0);
        const t = amberEl.querySelector('span:last-child');
        if (t) t.textContent = `${amber} soon`;
    }

    fold.classList.toggle('hidden', list.length === 0);
    if (labelEl) labelEl.textContent = body.classList.contains('hidden') ? `Show ${list.length}` : 'Hide';

    body.innerHTML = list.map(t => taskRowMarkup(t)).join('');
    refreshIcons();
}

function renderNavCount(open) {
    const el = document.getElementById('navNeedsCount');
    if (!el) return;
    // Counting only the red ones left a brand new account showing a zero
    // beside a list that plainly had things in it. This counts what is open,
    // which is what a number beside "Everything" is read as meaning.
    const n = (open || []).length;
    const urgent = (open || []).filter(t => t._calculatedState === 'Red' || t._calculatedState === 'Amber').length;
    el.textContent = n;
    el.classList.toggle('is-empty', n === 0);
    el.classList.toggle('is-urgent', urgent > 0);

    // "3" on its own means nothing read aloud. Spell it out instead, on the
    // button's own label, which survives the sidebar collapsing to icons.
    const suffix = n === 0
        ? ', nothing open'
        : `, ${n} open${urgent > 0 ? `, ${urgent} needing you` : ''}`;
    const text = document.getElementById('navNeedsCountText');
    if (text) text.textContent = suffix;
    const navItem = document.querySelector('.nav-menu .nav-item[data-tab="tasks"]');
    if (navItem) navItem.setAttribute('aria-label', 'Everything' + suffix);
}

function renderMomentum() {
    const el = document.getElementById('homeMomentum');
    const status = document.getElementById('userStatusLine');
    const todayStr = new Date().toISOString().split('T')[0];
    const done = (Array.isArray(tasks) ? tasks : []).filter(t => {
        if (!t.lastCompleted) return false;
        return new Date(t.lastCompleted).toISOString().split('T')[0] === todayStr;
    }).length;

    const line = done === 0
        ? 'Nothing done yet today. One thing is enough to start.'
        : `${done} done today.`;
    if (el) el.textContent = line;
    if (status) status.textContent = done === 0 ? 'Ready when you are' : `${done} done today`;
}



// Render the complete All Tasks & Habits grid in Tasks View with Search, Sort & Filter
// ============================================================
// EVERYTHING — three segments, an area narrowing, capped at three
// ============================================================
let tasksSegment = 'now';
let tasksArea = 'all';
let tasksUncapped = false;
// True once the user has picked a segment themselves. Until then the view
// chooses one that has something in it.
let tasksSegmentPinned = false;

function segmentOf(seg, list) {
    if (seg === 'now') return list.filter(t => t._calculatedState === 'Red' || t._calculatedState === 'Amber');
    if (seg === 'ticking') return list.filter(t => t._calculatedState === 'Green');
    if (seg === 'parked') return list.filter(t => t._calculatedState === 'Parked');
    return list;
}

// Which segment to open on.
//
// The default was always "Needs you", which is empty by construction for
// every new account - so somebody who had just made three tasks was shown a
// heading saying "Pick one of these" above an empty state saying "Nothing
// here". This picks the first segment that actually has something in it,
// and only until the user chooses one themselves.
function autoSegment(decorated) {
    if (tasksSegmentPinned) return tasksSegment;
    const order = ['now', 'ticking', 'parked', 'all'];
    for (const seg of order) {
        if (segmentOf(seg, decorated).length > 0) return seg;
    }
    return 'all';
}

function syncSegmentButtons() {
    document.querySelectorAll('#taskSegBar .seg').forEach(b => {
        const on = b.getAttribute('data-seg') === tasksSegment;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
}

// dateStr says which day this row is being shown on, so a nine o'clock thing
// listed under next Tuesday is not told it is already late this afternoon.
// One row, read left to right in the order it is acted on: tick it off,
// what it is, how long it takes, and only then the things you might do to
// it instead of doing it. `opts.lead` marks the one row worth starting
// with, which is the whole answer to "where do I begin".
function taskRowMarkup(task, dateStr, opts) {
    const o = opts || {};
    const state = task._calculatedState || task.state || calculateTaskState(task);
    const meta = stateMeta(state);
    const area = areaMeta(task.category);
    const mins = taskMinutes(task);
    const when = taskWhen(task);
    const nowish = whenIsNow(task, dateStr);
    const late = whenIsPast(task, dateStr);
    const done = taskDoneOn(task, dateStr);
    const name = esc(task.name);

    const cls = ['task-row', meta.cls];
    if (nowish && !done) cls.push('is-now');
    if (done) cls.push('is-done');
    if (o.lead && !done) cls.push('is-lead');

    return `
        <div class="${cls.join(' ')}" data-task-id="${task.id}">
            <span class="task-row-rail ${meta.cls}" aria-hidden="true"></span>
            <button type="button" class="tick-btn" aria-pressed="${done ? 'true' : 'false'}"
                    aria-label="${done ? `${name}: completed. Click to put back.` : `Tick off ${name}`}"
                    onclick="${done ? `uncompleteTask('${task.id}')` : `completeTask('${task.id}')`}">
                <i data-lucide="check"></i>
            </button>
            <span class="task-row-main">
                ${o.lead && !done ? '<span class="task-row-lead"><i data-lucide="arrow-right"></i>Start with this one</span>' : ''}
                <span class="task-row-name">${name}</span>
                <span class="task-row-meta">
                    <span class="task-row-when${late && !done ? ' is-late' : ''}" title="${esc(when.range)}"><i data-lucide="${when.icon}"></i>${esc(whenChipText(task, dateStr))}</span>
                    <span class="task-row-tag"><i data-lucide="${area.icon}"></i>${esc(area.short)}</span>
                    <span class="task-row-tag"><i data-lucide="${task.type === 'interval' ? 'refresh-cw' : 'calendar'}"></i>${esc(cadenceText(task))}</span>
                    ${nowish && !done ? '<span class="task-row-nowtag">Happening now</span>' : ''}
                </span>
            </span>
            <span class="task-row-side">
                <span class="task-row-mins" title="About ${mins} minutes"><b>${mins}</b><span>min</span></span>
                ${!done && meta.key !== 'green' ? `<span class="state-pill ${meta.cls}"><i data-lucide="${meta.icon}"></i>${meta.word}</span>` : ''}
                <span class="task-row-actions">
                    ${!done ? `<button type="button" class="btn btn-secondary row-later" aria-label="Push ${name} to later" onclick="openSnoozeMenu('${task.id}', this)">Later</button>` : ''}
                    <span class="row-more-wrap">
                        <button type="button" class="row-more" aria-haspopup="true" aria-expanded="false"
                                aria-label="More for ${name}" onclick="toggleRowMenu(this)">
                            <i data-lucide="more-horizontal"></i>
                        </button>
                        <span class="row-menu" role="menu">
                            <button type="button" role="menuitem" onclick="closeRowMenus(); openEditTaskModal('${task.id}')"><i data-lucide="edit-2"></i>Edit</button>
                            <button type="button" role="menuitem" class="is-danger" onclick="closeRowMenus(); deleteTask('${task.id}')"><i data-lucide="trash-2"></i>Delete</button>
                        </span>
                    </span>
                </span>
            </span>
        </div>
    `;
}

// Edit and Delete live behind one button. Three equally loud controls on a
// row is three decisions to get past before the row can be done at all,
// and the loudest of the three used to be the one that throws work away.
function closeRowMenus(except) {
    document.querySelectorAll('.row-more-wrap.open').forEach(wrap => {
        if (wrap === except) return;
        wrap.classList.remove('open');
        const btn = wrap.querySelector('.row-more');
        if (btn) btn.setAttribute('aria-expanded', 'false');
    });
}

function toggleRowMenu(btn) {
    const wrap = btn.closest('.row-more-wrap');
    if (!wrap) return;
    const opening = !wrap.classList.contains('open');
    closeRowMenus(wrap);
    wrap.classList.toggle('open', opening);
    btn.setAttribute('aria-expanded', opening ? 'true' : 'false');
    if (opening) {
        const first = wrap.querySelector('.row-menu button');
        if (first) first.focus();
    }
}

window.closeRowMenus = closeRowMenus;
window.toggleRowMenu = toggleRowMenu;

// Anywhere else on the page closes it, and so does Escape - but Escape has
// to be caught before the day sheet sees it, or one press would shut both
// the menu and the day behind it.
document.addEventListener('click', (e) => {
    if (!e.target.closest || !e.target.closest('.row-more-wrap')) closeRowMenus();
});

document.addEventListener('keydown', (e) => {
    const wrap = document.querySelector('.row-more-wrap.open');
    if (!wrap) return;

    if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        const btn = wrap.querySelector('.row-more');
        closeRowMenus();
        if (btn) btn.focus();
        return;
    }

    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const items = Array.from(wrap.querySelectorAll('.row-menu button'));
    if (!items.length) return;
    e.preventDefault();
    e.stopPropagation();
    const at = items.indexOf(document.activeElement);
    const step = e.key === 'ArrowDown' ? 1 : -1;
    items[(at + step + items.length) % items.length].focus();
}, true);

function renderAllTasksGrid() {
    const grid = document.getElementById('allTasksGrid');
    if (!grid) return;
    grid.innerHTML = '';
    if (!Array.isArray(tasks)) return;

    const searchQuery = (document.getElementById('taskSearchInput')?.value || '').toLowerCase().trim();
    const sortMode = document.getElementById('taskSortSelect')?.value || 'urgency';

    const decorated = tasks.map(t => Object.assign({}, t, { _calculatedState: t.state || calculateTaskState(t) }));

    // Counts live inside the control, so nothing has to be scanned to be counted
    document.querySelectorAll('[data-seg-count]').forEach(el => {
        el.textContent = segmentOf(el.getAttribute('data-seg-count'), decorated).length;
    });

    tasksSegment = autoSegment(decorated);
    syncSegmentButtons();

    let filtered = segmentOf(tasksSegment, decorated);
    if (tasksArea !== 'all') filtered = filtered.filter(t => t.category === tasksArea);
    if (searchQuery) {
        filtered = filtered.filter(t =>
            (t.name && t.name.toLowerCase().includes(searchQuery)) ||
            (t.description && t.description.toLowerCase().includes(searchQuery)) ||
            (t.category && t.category.toLowerCase().includes(searchQuery))
        );
    }

    const dueMs = (t) => t.dueDate
        ? new Date(t.dueDate).getTime()
        : (t.lastCompleted ? new Date(t.lastCompleted).getTime() + (parseInt(t.intervalDays) || 1) * 86400000 : 0);

    const shape = dayShape();
    const whenKey = (t) => taskWhen(t, shape).sortKey;

    filtered.sort((x, y) => {
        if (sortMode === 'name') return (x.name || '').localeCompare(y.name || '');
        if (sortMode === 'order') return (x.displayOrder ?? 0) - (y.displayOrder ?? 0);
        if (sortMode === 'time') return (whenKey(x) - whenKey(y)) || (dueMs(x) - dueMs(y));
        if (sortMode === 'dueDate') return (dueMs(x) - dueMs(y)) || (whenKey(x) - whenKey(y));
        const rank = (s) => (s === 'Red' ? 1 : s === 'Amber' ? 2 : 3);
        // Time of day is the last word in every ordering: once two things are
        // equally urgent and equally soon, the one that happens earlier in
        // the day is the one to be offered first.
        return (rank(x._calculatedState) - rank(y._calculatedState)) || (dueMs(x) - dueMs(y)) || (whenKey(x) - whenKey(y));
    });

    const heading = document.getElementById('tasksListHeading');
    if (heading) {
        heading.textContent = tasksSegment === 'now' ? 'Needs attention'
            : tasksSegment === 'ticking' ? 'Active tasks'
            : tasksSegment === 'parked' ? 'Parked thoughts'
            : 'All tasks';
    }

    const areaSelect = document.getElementById('taskAreaSelect');
    if (areaSelect && areaSelect.value !== tasksArea) {
        areaSelect.value = tasksArea;
    }

    // Rule 3: a list you can see the end of gets started
    const CAP = 3;
    const capped = uiPrefs.capThree && !tasksUncapped && filtered.length > CAP;
    const visible = capped ? filtered.slice(0, CAP) : filtered;

    const shownLine = document.getElementById('tasksShownLine');
    if (shownLine) {
        const hidden = decorated.length - visible.length;
        shownLine.textContent = hidden > 0
            ? `Showing ${visible.length} of ${decorated.length}.`
            : `${decorated.length} task${decorated.length === 1 ? '' : 's'}.`;
    }

    const moreBtn = document.getElementById('showMoreBtn');
    const moreLabel = document.getElementById('showMoreLabel');
    if (moreBtn) {
        moreBtn.classList.toggle('hidden', !capped);
        if (moreLabel && capped) moreLabel.textContent = `Show the other ${filtered.length - CAP}`;
    }

    const capLabel = document.getElementById('capToggleLabel');
    if (capLabel) capLabel.textContent = uiPrefs.capThree ? 'Three at a time' : 'Showing all';

    if (filtered.length === 0) {
        const elsewhere = ['now', 'ticking', 'parked']
            .filter(seg => seg !== tasksSegment)
            .map(seg => ({ seg: seg, n: segmentOf(seg, decorated).length }))
            .filter(x => x.n > 0);

        const word = { now: 'need attention', ticking: 'active', parked: 'parked' };
        const outs = elsewhere.map(x =>
            `<button type="button" class="empty-jump" data-jump-seg="${x.seg}">${x.n} ${word[x.seg]} &rarr;</button>`
        ).join('');

        const why = searchQuery
            ? `Nothing matches &ldquo;${esc(searchQuery)}&rdquo;.`
            : tasksSegment === 'now' ? 'Nothing needs attention right now.'
            : tasksSegment === 'ticking' ? 'No active tasks right now.'
            : tasksSegment === 'parked' ? 'No parked thoughts.'
            : 'Nothing here yet.';

        grid.innerHTML = `
            <div class="done-empty">
                <i data-lucide="check-circle-2"></i>
                <strong>${why}</strong>
                ${outs
                    ? `<span>The rest of your list is still here:</span><span class="empty-jumps">${outs}</span>`
                    : '<span>That is a finished list, not a mistake.</span>'}
            </div>
        `;
        grid.querySelectorAll('[data-jump-seg]').forEach(btn => {
            btn.addEventListener('click', () => {
                tasksSegment = btn.getAttribute('data-jump-seg');
                tasksSegmentPinned = true;
                tasksUncapped = false;
                renderAllTasksGrid();
            });
        });
        refreshIcons();
        return;
    }

    // Partition active vs completed tasks so completed items don't crowd the active working space
    const activeTasks = visible.filter(t => !taskDoneOn(t));
    const doneTasks = visible.filter(t => taskDoneOn(t));

    let html = activeTasks.map(t => taskRowMarkup(t)).join('');
    if (doneTasks.length > 0) {
        if (activeTasks.length > 0) {
            html += `
                <details class="completed-tasks-wrap">
                    <summary class="completed-tasks-summary">
                        <i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i>
                        <span>Completed (${doneTasks.length})</span>
                    </summary>
                    <div class="completed-tasks-list">
                        ${doneTasks.map(t => taskRowMarkup(t)).join('')}
                    </div>
                </details>
            `;
        } else {
            // When all tasks in view are done
            html += `
                <div class="completed-tasks-list">
                    ${doneTasks.map(t => taskRowMarkup(t)).join('')}
                </div>
            `;
        }
    }

    grid.innerHTML = html;
    refreshIcons();
}

// 5. SVG Consistency Chart rendering
let activeTooltip = null;

// The SVG chart is unreadable to a screen reader and to anyone who cannot
// distinguish the line from the grid. This table holds the same numbers and sits
// under a disclosure right below the chart.
function renderAnalyticsDataTable(rows) {
    const body = document.getElementById('analyticsDataTableBody');
    if (!body) return;

    if (!rows || rows.length === 0) {
        body.innerHTML = '<tr><td colspan="4">No history yet.</td></tr>';
        return;
    }

    body.innerHTML = rows.map(r => {
        const label = new Date(r.date).toLocaleDateString('en-GB', {
            weekday: 'short', day: 'numeric', month: 'short'
        });
        return `<tr>
            <th scope="row">${esc(label)}</th>
            <td>${esc(r.completed)}</td>
            <td>${esc(r.total)}</td>
            <td>${esc(r.rate)}%</td>
        </tr>`;
    }).join('');
}

function renderAnalyticsGraph() {
    const wrapper = document.getElementById('svgWrapper');
    if (!wrapper) return;
    
    wrapper.innerHTML = '';
    
    if (!historyData || historyData.length === 0) {
        wrapper.innerHTML = `
            <div class="digest-empty">
                <i data-lucide="info" aria-hidden="true"></i>
                <p>Nothing to chart yet. Tick a few things off and your history will build here.</p>
            </div>
        `;
        renderAnalyticsDataTable([]);
        refreshIcons();
        return;
    }
    
    // Sort history chronologically by date
    let sortedHistory = [...historyData].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Slice to the requested range (last 7 or 30 days)
    sortedHistory = sortedHistory.slice(-chartRange);

    renderAnalyticsDataTable(sortedHistory);
    
    const width = wrapper.clientWidth || 500;
    const height = 180;
    
    const paddingLeft = 45;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;
    
    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;
    
    // SVG element creation
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "100%");
    svg.setAttribute("height", "100%");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    // The table under the chart is the accessible equivalent, so the drawing
    // itself is hidden rather than announced as a wall of unlabelled shapes.
    svg.setAttribute("role", "img");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.style.overflow = "visible";
    
    // Grid Lines (Horizontal Levels)
    const gridLevels = [0, 25, 50, 75, 100];
    gridLevels.forEach(level => {
        const y = paddingTop + chartHeight - (level / 100) * chartHeight;
        
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", paddingLeft);
        line.setAttribute("y1", y);
        line.setAttribute("x2", width - paddingRight);
        line.setAttribute("y2", y);
        line.setAttribute("stroke", "var(--chart-grid)");
        line.setAttribute("stroke-width", "1");
        if (level > 0 && level < 100) {
            line.setAttribute("stroke-dasharray", "4,4");
        }
        svg.appendChild(line);
        
        const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
        label.setAttribute("x", paddingLeft - 10);
        label.setAttribute("y", y + 4);
        label.setAttribute("text-anchor", "end");
        label.setAttribute("fill", "var(--text-secondary)");
        label.setAttribute("font-size", "10px");
        label.setAttribute("font-weight", "500");
        label.textContent = `${level}%`;
        svg.appendChild(label);
    });
    
    // Convert history logs to coordinate points
    const points = sortedHistory.map((d, index) => {
        const x = paddingLeft + (index / Math.max(1, sortedHistory.length - 1)) * chartWidth;
        const y = paddingTop + chartHeight - (d.rate / 100) * chartHeight;
        return { x, y, date: d.date, rate: d.rate, completed: d.completed, total: d.total };
    });
    
    // Area Gradient Definition
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const gradient = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    gradient.setAttribute("id", "svg-glow-gradient");
    gradient.setAttribute("x1", "0");
    gradient.setAttribute("y1", "0");
    gradient.setAttribute("x2", "0");
    gradient.setAttribute("y2", "1");
    
    const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "var(--color-primary-light)");
    stop1.setAttribute("stop-opacity", "0.3");
    
    const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", "var(--color-primary-light)");
    stop2.setAttribute("stop-opacity", "0.0");
    
    gradient.appendChild(stop1);
    gradient.appendChild(stop2);
    defs.appendChild(gradient);
    svg.appendChild(defs);
    
    // Draw area path below the curve
    if (points.length > 1) {
        let areaD = `M ${points[0].x} ${paddingTop + chartHeight}`;
        points.forEach(p => {
            areaD += ` L ${p.x} ${p.y}`;
        });
        areaD += ` L ${points[points.length - 1].x} ${paddingTop + chartHeight} Z`;
        
        const areaPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        areaPath.setAttribute("d", areaD);
        areaPath.setAttribute("fill", "url(#svg-glow-gradient)");
        svg.appendChild(areaPath);
    }
    
    // Draw line curve path
    if (points.length > 1) {
        let lineD = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            lineD += ` L ${points[i].x} ${points[i].y}`;
        }
        
        const linePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        linePath.setAttribute("d", lineD);
        linePath.setAttribute("fill", "none");
        linePath.setAttribute("stroke", "var(--color-primary-light)");
        linePath.setAttribute("stroke-width", "3");
        linePath.setAttribute("stroke-linecap", "round");
        linePath.setAttribute("stroke-linejoin", "round");
        linePath.setAttribute("filter", "drop-shadow(0px 3px 5px var(--color-primary-glow))");
        svg.appendChild(linePath);
    }
    
    // Draw point interactive nodes and label values
    points.forEach((p, idx) => {
        // Glowing halo circle on hover
        const halo = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        halo.setAttribute("cx", p.x);
        halo.setAttribute("cy", p.y);
        halo.setAttribute("r", "8");
        halo.setAttribute("fill", "var(--color-primary-light)");
        halo.setAttribute("opacity", "0");
        halo.style.transition = "opacity 0.2s ease";
        svg.appendChild(halo);
        
        // Solid center point
        const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        dot.setAttribute("cx", p.x);
        dot.setAttribute("cy", p.y);
        dot.setAttribute("r", "4.5");
        dot.setAttribute("fill", "var(--bg-dark-gray)");
        dot.setAttribute("stroke", "var(--color-primary-light)");
        dot.setAttribute("stroke-width", "2.5");
        dot.style.cursor = "pointer";
        svg.appendChild(dot);
        
        // X-axis text labeling
        const xLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
        xLabel.setAttribute("x", p.x);
        xLabel.setAttribute("y", paddingTop + chartHeight + 18);
        xLabel.setAttribute("text-anchor", "middle");
        xLabel.setAttribute("fill", "var(--text-secondary)");
        xLabel.setAttribute("font-size", "9px");
        xLabel.setAttribute("font-weight", "500");
        
        // Show weekdays for 7-day range, date numbers for 30-day range
        const parsedDate = new Date(p.date + 'T00:00:00');
        if (chartRange <= 7) {
            xLabel.textContent = parsedDate.toLocaleDateString(undefined, { weekday: 'short' });
        } else {
            // Show label for every 4th day to prevent text overlaps
            if (idx % 4 === 0 || idx === points.length - 1) {
                xLabel.textContent = parsedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
            } else {
                xLabel.textContent = '';
            }
        }
        svg.appendChild(xLabel);
        
        // Transparent thick circle overlay for mouse triggers
        const hoverArea = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        hoverArea.setAttribute("cx", p.x);
        hoverArea.setAttribute("cy", p.y);
        hoverArea.setAttribute("r", "15");
        hoverArea.setAttribute("fill", "transparent");
        hoverArea.style.cursor = "pointer";
        
        hoverArea.addEventListener('mouseenter', (e) => {
            halo.setAttribute("opacity", "0.4");
            dot.setAttribute("r", "5.5");
            dot.setAttribute("fill", "var(--color-primary-light)");
            showChartTooltip(e, p);
        });
        
        hoverArea.addEventListener('mouseleave', () => {
            halo.setAttribute("opacity", "0");
            dot.setAttribute("r", "4.5");
            dot.setAttribute("fill", "var(--bg-dark-gray)");
            hideChartTooltip();
        });
        
        svg.appendChild(hoverArea);
    });
    
    wrapper.appendChild(svg);
}

// Tooltip helpers
function showChartTooltip(event, point) {
    hideChartTooltip();
    
    const wrapper = document.getElementById('svgWrapper');
    const tooltip = document.createElement('div');
    tooltip.className = 'chart-tooltip';
    
    const parsedDate = new Date(point.date + 'T00:00:00');
    const formattedDate = parsedDate.toLocaleDateString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric',
        year: 'numeric' 
    });
    
    tooltip.innerHTML = `
        <span class="chart-tooltip-date">${formattedDate}</span>
        <span class="chart-tooltip-value">Compliance: ${point.rate}%</span>
        <span class="chart-tooltip-detail" style="font-size: 0.7rem; color: var(--text-secondary);">
            Done: ${point.completed} / Total due: ${point.total}
        </span>
    `;
    
    wrapper.appendChild(tooltip);
    
    const wrapperRect = wrapper.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    const left = point.x - (tooltipRect.width / 2);
    const top = point.y - tooltipRect.height - 10;
    
    tooltip.style.left = `${Math.max(5, Math.min(left, wrapperRect.width - tooltipRect.width - 5))}px`;
    tooltip.style.top = `${Math.max(5, top)}px`;
    
    activeTooltip = tooltip;
}

function hideChartTooltip() {
    if (activeTooltip) {
        activeTooltip.remove();
        activeTooltip = null;
    }
}

// 6. Action Handlers

// Complete Task Action
// Completing writes a permanent log, clears the snooze and pushes the due
// date on by a whole interval. That is a lot to happen from one tap eight
// pixels from the row above, so every one of these offers the way back.
async function completeTask(id) {
    try {
        await apiRequest(`/tasks/${id}/complete`, 'POST');
        // Plain, past tense, no exclamation mark, and no mention of a streak -
        // streaks are off by default and reporting one to somebody who turned
        // them off is the app talking about itself instead of to them.
        showToast('Done.', 'success', {
            action: { label: 'Undo', onClick: () => uncompleteTask(id) }
        });
        await loadDashboardData();
    } catch (err) {
        console.error("Failed completing task.", err);
        showToast("Could not mark that done. It is still on your list.", "error");
    }
}

async function uncompleteTask(id) {
    try {
        await apiRequest(`/tasks/${id}/complete`, 'DELETE');
        showToast('Put back.');
        await loadDashboardData();
    } catch (err) {
        console.error("Failed undoing completion.", err);
        showToast("Could not undo that.", "error");
    }
}

// Snooze lengths are offered where the decision is made rather than read out
// of a setting chosen months ago. `hours` omitted falls back to that setting,
// which is what the keyboard path and the older call sites still use.
async function snoozeTask(id, hours) {
    try {
        const durationHours = parseInt(hours) || parseInt(localStorage.getItem('bokea_default_snooze')) || 24;
        await apiRequest(`/tasks/${id}/snooze`, 'POST', { durationHours });
        showToast(`Back ${snoozeWordFor(durationHours)}.`, 'success', {
            action: { label: 'Undo', onClick: () => unsnoozeTask(id) }
        });
        await loadDashboardData();
    } catch (err) {
        console.error("Failed snoozing task.", err);
        showToast("Could not put that off.", "error");
    }
}

async function unsnoozeTask(id) {
    try {
        await apiRequest(`/tasks/${id}/snooze`, 'POST', { durationHours: 0 });
        showToast('Back on your list.');
        await loadDashboardData();
    } catch (err) {
        console.error("Failed undoing snooze.", err);
        showToast("Could not undo that.", "error");
    }
}

function snoozeWordFor(hours) {
    const h = parseInt(hours) || 24;
    if (h <= 1) return 'in an hour';
    if (h <= 4) return 'later today';
    if (h <= 14) return 'tonight';
    if (h <= 24) return 'tomorrow';
    const d = Math.round(h / 24);
    return `in ${d} days`;
}

// A small menu at the point of use: "an hour / tonight / tomorrow" is a
// decision somebody can make about the thing in front of them. One global
// snooze length set once in Settings is not.
const SNOOZE_CHOICES = [
    { hours: 1,  label: 'An hour' },
    { hours: 5,  label: 'Tonight' },
    { hours: 24, label: 'Tomorrow' },
    { hours: 72, label: 'Three days' }
];

function openSnoozeMenu(id, anchor) {
    closeSnoozeMenu();
    const el = anchor || document.activeElement;
    if (!el) { snoozeTask(id); return; }

    const menu = document.createElement('div');
    menu.className = 'snooze-menu';
    menu.id = 'snoozeMenu';
    menu.setAttribute('role', 'menu');
    menu.setAttribute('aria-label', 'Put this off until');

    SNOOZE_CHOICES.forEach(choice => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'snooze-menu-item';
        btn.setAttribute('role', 'menuitem');
        btn.textContent = choice.label;
        btn.addEventListener('click', () => {
            closeSnoozeMenu();
            snoozeTask(id, choice.hours);
        });
        menu.appendChild(btn);
    });

    document.body.appendChild(menu);
    const r = el.getBoundingClientRect();
    const menuH = menu.offsetHeight || 180;
    let top = r.bottom + window.scrollY + 6;
    if (r.bottom + menuH + 12 > window.innerHeight && r.top - menuH - 6 > 0) {
        top = r.top + window.scrollY - menuH - 6;
    }
    menu.style.top = `${Math.round(top)}px`;
    // Keep it on screen on a narrow phone rather than running off the edge.
    const left = Math.min(r.left + window.scrollX, window.innerWidth - menu.offsetWidth - 12);
    menu.style.left = `${Math.round(Math.max(12, left))}px`;

    const first = menu.querySelector('button');
    if (first) first.focus();

    menu._return = el;
    setTimeout(() => {
        document.addEventListener('click', closeSnoozeMenuOnOutside, true);
        document.addEventListener('keydown', closeSnoozeMenuOnEscape, true);
    }, 0);
}

function closeSnoozeMenu() {
    const menu = document.getElementById('snoozeMenu');
    if (!menu) return;
    const back = menu._return;
    menu.remove();
    document.removeEventListener('click', closeSnoozeMenuOnOutside, true);
    document.removeEventListener('keydown', closeSnoozeMenuOnEscape, true);
    if (back && document.contains(back)) back.focus();
}

function closeSnoozeMenuOnOutside(e) {
    const menu = document.getElementById('snoozeMenu');
    if (menu && !menu.contains(e.target)) closeSnoozeMenu();
}

function closeSnoozeMenuOnEscape(e) {
    if (e.key === 'Escape') { e.preventDefault(); closeSnoozeMenu(); }
}

// Delete asks in place, on the row, with the task's own name in the question -
// the same pattern Settings already uses for "empty the app". A native
// confirm() is the dialog everybody dismisses without reading, which is
// exactly the wrong instrument for the only irreversible action here.
function deleteTask(id) {
    const task = (Array.isArray(tasks) ? tasks : []).find(t => String(t.id) === String(id));
    const row = document.querySelector(`[data-task-id="${CSS.escape(String(id))}"]`);
    if (!row || row.querySelector('.row-confirm')) {
        if (row) closeRowConfirm();
        return;
    }
    closeRowConfirm();

    const bar = document.createElement('div');
    bar.className = 'row-confirm';
    bar.setAttribute('role', 'group');
    bar.setAttribute('aria-label', 'Confirm delete');
    bar.innerHTML = `
        <span class="row-confirm-q">Delete &ldquo;${esc(task ? task.name : 'this')}&rdquo; for good?</span>
        <button type="button" class="btn btn-secondary row-confirm-keep">Keep it</button>
        <button type="button" class="btn row-confirm-go">Delete</button>
    `;
    row.appendChild(bar);
    row.classList.add('is-confirming');

    bar.querySelector('.row-confirm-keep').addEventListener('click', closeRowConfirm);
    bar.querySelector('.row-confirm-go').addEventListener('click', () => reallyDeleteTask(id));
    bar.querySelector('.row-confirm-go').focus();
}

function closeRowConfirm() {
    document.querySelectorAll('.row-confirm').forEach(el => el.remove());
    document.querySelectorAll('.is-confirming').forEach(el => el.classList.remove('is-confirming'));
}

async function reallyDeleteTask(id) {
    closeRowConfirm();
    try {
        await apiRequest(`/tasks/${id}`, 'DELETE');
        // Delete duration
        const durations = JSON.parse(localStorage.getItem('bokea_task_durations') || '{}');
        delete durations[id];
        localStorage.setItem('bokea_task_durations', JSON.stringify(durations));
        showToast("Deleted.");
        await loadDashboardData();
    } catch (err) {
        console.error("Failed deleting task.", err);
        showToast("Could not delete that.", "error");
    }
}

// 7. Modals and Creation Form Logic

const modal = document.getElementById('taskModal');
const taskForm = document.getElementById('taskForm');
const intervalGroup = document.getElementById('intervalGroup');
const dueDateGroup = document.getElementById('dueDateGroup');

let currentStep = 1;

// The form is one screen now, so there is nothing to step through. This stays
// because openCreateTaskModal, openEditTaskModal and the keyboard handler all
// still call it, and because the .wizard-step wrappers still carry the
// grouping the option buttons are found by. All it does is make sure every
// group is visible and Save is available.
function showStep(stepNum) {
    currentStep = stepNum || 1;
    document.querySelectorAll('.wizard-step').forEach(step => {
        step.className = 'wizard-step wizard-step-active';
    });
    const saveBtn = document.getElementById('saveTaskBtn');
    if (saveBtn) saveBtn.classList.remove('hidden');
    syncSaveEnabled();
}

// Save is live from the moment there is a name, and says so rather than
// failing with a toast after the fact.
function syncSaveEnabled() {
    const nameEl = document.getElementById('taskName');
    const saveBtn = document.getElementById('saveTaskBtn');
    if (!nameEl || !saveBtn) return;
    const ok = !!nameEl.value.trim();
    saveBtn.disabled = !ok;
    saveBtn.setAttribute('aria-disabled', ok ? 'false' : 'true');
    saveBtn.title = ok ? '' : 'Give it a name first';
}

// Wire wizard option click event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Step 1 Category Buttons
    document.querySelectorAll('.wizard-step[data-step="1"] .wizard-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.wizard-step[data-step="1"] .wizard-option-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const catVal = btn.getAttribute('data-value');
            document.getElementById('taskCategory').value = catVal;
            
            syncTaskNameUI(catVal);
            
            // Auto advance to step 2 after a small delay for delightful feedback
            setTimeout(() => {
                if (currentStep === 1) showStep(2);
            }, 250);
        });
    });

    // Task Name Select dropdown change listener
    const taskNameSelect = document.getElementById('taskNameSelect');
    if (taskNameSelect) {
        taskNameSelect.addEventListener('change', () => {
            const selectedOpt = taskNameSelect.options[taskNameSelect.selectedIndex];
            if (!selectedOpt || !selectedOpt.value) {
                document.getElementById('taskName').value = "";
                syncSaveEnabled();
                return;
            }

            const name = selectedOpt.getAttribute('data-name');
            const desc = selectedOpt.getAttribute('data-desc');
            const dur = selectedOpt.getAttribute('data-duration');
            const slot = selectedOpt.getAttribute('data-slot');
            
            document.getElementById('taskName').value = name;
            document.getElementById('taskDescription').value = desc;
            
            const durHidden = document.getElementById('taskDuration');
            if (durHidden) durHidden.value = dur;
            const durInput = document.getElementById('taskDurationInput');
            if (durInput) durInput.value = dur;

            if (slot) {
                const slotInput = document.getElementById('taskTimeSlot');
                if (slotInput) slotInput.value = slot;
                document.querySelectorAll('#timeSlotGrid button').forEach(b => {
                    b.classList.toggle('active', b.getAttribute('data-slot') === slot);
                });
            }
            
            document.getElementById('taskName').classList.remove('input-error');
            syncSaveEnabled();
        });
    }

    // Step 3 Frequency Buttons
    document.querySelectorAll('.wizard-step[data-step="3"] .wizard-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.wizard-step[data-step="3"] .wizard-option-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const freqType = btn.getAttribute('data-freq-type');
            document.getElementById('taskType').value = freqType === 'fixed' ? 'fixed' : 'interval';
            
            const freqVal = btn.getAttribute('data-freq-val');
            if (freqVal) {
                document.getElementById('taskInterval').value = freqVal;
            }
            
            // Toggle input groups
            if (freqType === 'custom') {
                intervalGroup.classList.remove('hidden');
                dueDateGroup.classList.add('hidden');
                setTimeout(() => {
                    const input = document.getElementById('taskInterval');
                    if (input) input.focus({ preventScroll: true });
                }, 50);
            } else if (freqType === 'fixed') {
                intervalGroup.classList.add('hidden');
                dueDateGroup.classList.remove('hidden');
                setTimeout(() => {
                    const input = document.getElementById('taskDueDate');
                    if (input) input.focus({ preventScroll: true });
                }, 50);
            } else {
                intervalGroup.classList.add('hidden');
                dueDateGroup.classList.add('hidden');
                // Auto advance since it's a fixed standard interval (daily, weekly, monthly)
                setTimeout(() => {
                    if (currentStep === 3) showStep(4);
                }, 250);
            }
        });
    });

    // Step 4 Notification Buttons
    document.querySelectorAll('.wizard-step[data-step="4"] .wizard-option-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.wizard-step[data-step="4"] .wizard-option-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('taskNotify').value = btn.getAttribute('data-value');
        });
    });

    // Time Slot Routine Block Buttons
    document.querySelectorAll('#timeSlotGrid button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.getElementById('taskTimeSlot').value = btn.getAttribute('data-slot') || 'anytime';
            syncWhenUI();
        });
    });

    const dueTimeEl = document.getElementById('taskDueTime');
    if (dueTimeEl) dueTimeEl.addEventListener('input', syncWhenUI);

    // Template select auto-fill
    const selectTemplateEl = document.getElementById('taskNameSelect');
    if (selectTemplateEl) {
        selectTemplateEl.addEventListener('change', () => {
            const opt = selectTemplateEl.options[selectTemplateEl.selectedIndex];
            if (opt && opt.value) {
                const name = opt.getAttribute('data-name');
                const desc = opt.getAttribute('data-desc');
                const dur = opt.getAttribute('data-duration');
                const slot = opt.getAttribute('data-slot');
                if (name) {
                    const nameInput = document.getElementById('taskName');
                    if (nameInput) {
                        nameInput.value = name;
                        nameInput.classList.remove('input-error');
                    }
                }
                if (desc) {
                    const descInput = document.getElementById('taskDescription');
                    if (descInput && !descInput.value.trim()) descInput.value = desc;
                }
                if (dur) {
                    const durInput = document.getElementById('taskDurationInput');
                    if (durInput) durInput.value = dur;
                    const durHidden = document.getElementById('taskDuration');
                    if (durHidden) durHidden.value = dur;
                }
                if (slot) {
                    const slotHidden = document.getElementById('taskTimeSlot');
                    if (slotHidden) slotHidden.value = slot;
                    document.querySelectorAll('#timeSlotGrid button').forEach(b => {
                        b.classList.toggle('active', b.getAttribute('data-slot') === slot);
                    });
                }
            }
        });
    }

    // Input event listeners to clear error outlines
    document.getElementById('taskName').addEventListener('input', (e) => e.target.classList.remove('input-error'));
    document.getElementById('taskDueDate').addEventListener('input', (e) => e.target.classList.remove('input-error'));
    document.getElementById('taskInterval').addEventListener('input', (e) => e.target.classList.remove('input-error'));

    // Prevent premature form submission on Enter key press
    const taskFormEl = document.getElementById('taskForm');
    if (taskFormEl) {
        taskFormEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.target.tagName.toLowerCase() === 'textarea') return;
                e.preventDefault();
                // One screen, so Enter means save. If there is no name yet it
                // puts the cursor where the answer goes instead of scolding.
                const nameEl = document.getElementById('taskName');
                if (nameEl && !nameEl.value.trim()) {
                    nameEl.classList.add('input-error');
                    nameEl.focus();
                    return;
                }
                const saveBtn = document.getElementById('saveTaskBtn');
                if (saveBtn) saveBtn.click();
            }
        });
    }

    // The four-step navigation is gone with the four steps. What is left is
    // the one thing it was really for: keeping Save honest about whether the
    // form can be saved yet.
    const nameField = document.getElementById('taskName');
    if (nameField) {
        nameField.addEventListener('input', () => {
            nameField.classList.remove('input-error');
            syncSaveEnabled();
        });
    }

    const cancelBtn = document.getElementById('cancelTaskBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', () => closeModal());

    // "This one really matters" - the only thing allowed to turn a task red.
    const commitSw = document.getElementById('taskCommitmentSw');
    if (commitSw) {
        commitSw.addEventListener('click', () => {
            const on = commitSw.getAttribute('aria-checked') !== 'true';
            setCommitmentSwitch(on);
        });
    }
});

function setCommitmentSwitch(on) {
    const sw = document.getElementById('taskCommitmentSw');
    if (!sw) return;
    sw.setAttribute('aria-checked', on ? 'true' : 'false');
    sw.classList.toggle('on', on);
    const word = sw.querySelector('.sw-word');
    if (word) word.textContent = on ? 'On' : 'Off';
}

function commitmentSwitchOn() {
    const sw = document.getElementById('taskCommitmentSw');
    return !!(sw && sw.getAttribute('aria-checked') === 'true');
}

// Helper to clear error highlights
function clearValidationErrors() {
    document.querySelectorAll('.input-error').forEach(el => {
        el.classList.remove('input-error');
    });
}

// Show/hide taskName select or input based on category
function syncTaskNameUI(category) {
    const inputGroup = document.getElementById('taskNameInputGroup');
    const selectGroup = document.getElementById('taskNameSelectGroup');
    const selectEl = document.getElementById('taskNameSelect');
    const inputEl = document.getElementById('taskName');
    
    // Always keep custom task name input accessible
    if (inputGroup) inputGroup.style.display = 'block';
    if (inputEl) inputEl.required = true;

    if (category === 'Health & Vitality') {
        if (selectGroup) selectGroup.style.display = 'block';
        if (selectEl) selectEl.required = false;
    } else {
        if (selectGroup) selectGroup.style.display = 'none';
        if (selectEl) {
            selectEl.required = false;
            selectEl.value = "";
        }
    }
}

// Open create modal
// The modal's two time answers must never contradict each other. Naming an
// exact time settles which block it falls in, so the buttons follow the clock
// rather than sitting there disagreeing with it. Clearing the time hands the
// choice back. Each block shows its own real hours, so nobody has to guess
// what this app thinks "evening" means for them.
function syncWhenUI() {
    const shape = dayShape();
    document.querySelectorAll('[data-slot-range]').forEach(el => {
        const win = slotWindow(el.getAttribute('data-slot-range'), shape);
        el.textContent = `${fmtHM(win.from)}\u2013${fmtHM(win.to)}`;
    });

    const timeInput = document.getElementById('taskDueTime');
    const hint = document.getElementById('taskDueTimeHint');
    const hidden = document.getElementById('taskTimeSlot');
    if (!timeInput) return;

    const value = timeInput.value;
    const exact = /^\d{1,2}:\d{2}$/.test(value) ? parseHM(value, null) : null;

    // One place decides which button is lit, and says so out loud as well as
    // in the styling, so the choice is not carried by a border alone.
    const mark = (slot, locked) => {
        document.querySelectorAll('#timeSlotGrid button').forEach(b => {
            const on = b.getAttribute('data-slot') === slot;
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', on ? 'true' : 'false');
            // Not greyed out and unexplained: when an exact time is given the
            // block is already answered by the clock above it, and clearing
            // that time hands the choice straight back.
            b.disabled = locked;
        });
    };

    if (exact === null) {
        if (hint) hint.textContent = '';
        mark(hidden ? hidden.value : 'anytime', false);
        return;
    }

    const slot = slotForMinutes(exact, shape);
    if (hidden) hidden.value = slot;
    if (hint) hint.textContent = `${fmtHM(exact)} falls in your ${SLOT_META[slot].label.toLowerCase()}.`;
    mark(slot, true);
}

function openCreateTaskModal(category, presetDate) {
    clearValidationErrors();
    document.getElementById('modalTitle').textContent = "New task";
    document.getElementById('taskId').value = "";
    document.getElementById('taskName').value = "";
    document.getElementById('taskDescription').value = "";
    document.getElementById('taskDuration').value = "15";
    const durInput = document.getElementById('taskDurationInput');
    if (durInput) durInput.value = "15";
    const dueTimeInput = document.getElementById('taskDueTime');
    if (dueTimeInput) dueTimeInput.value = "";
    document.getElementById('taskTimeSlot').value = "anytime";
    document.querySelectorAll('#timeSlotGrid button').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-slot') === 'anytime');
    });
    syncWhenUI();

    const cat = category || "Health & Vitality";
    document.getElementById('taskCategory').value = cat;
    
    syncTaskNameUI(cat);
    
    // Sync Category Step 1 button active state
    document.querySelectorAll('.wizard-step[data-step="1"] .wizard-option-btn').forEach(btn => {
        if (btn.getAttribute('data-value') === cat) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    if (presetDate) {
        document.getElementById('taskType').value = 'fixed';
        document.getElementById('taskDueDate').value = presetDate;
        document.getElementById('taskInterval').value = "1";
        document.querySelectorAll('.wizard-step[data-step="3"] .wizard-option-btn').forEach(b => b.classList.remove('active'));
        const fixedBtn = document.getElementById('btnFixedDate');
        if (fixedBtn) fixedBtn.classList.add('active');
        intervalGroup.classList.add('hidden');
        dueDateGroup.classList.remove('hidden');
    } else {
        document.getElementById('taskType').value = 'interval';
        document.getElementById('taskInterval').value = "1";
        document.getElementById('taskDueDate').value = "";
        // Default is Daily = 1 day interval
        document.querySelectorAll('.wizard-step[data-step="3"] .wizard-option-btn').forEach(btn => {
            if (btn.getAttribute('data-freq-type') === 'interval' && btn.getAttribute('data-freq-val') === '1') {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        intervalGroup.classList.add('hidden');
        dueDateGroup.classList.add('hidden');
    }
    
    // Sync Notify Step 4 button active state (Default is digest)
    document.querySelectorAll('.wizard-step[data-step="4"] .wizard-option-btn').forEach(btn => {
        if (btn.getAttribute('data-value') === 'digest') {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    setCommitmentSwitch(false);

    // "More" starts closed on a new task: everything inside it already has a
    // sensible answer, and the point of the screen is the field above it.
    const more = document.getElementById('taskMore');
    if (more) more.open = false;

    showStep(1);
    openModal('New task');

    // Land the cursor in the only field that has to be filled in, so the
    // thought that prompted the click can be typed straight out.
    const nameEl = document.getElementById('taskName');
    if (nameEl) setTimeout(() => nameEl.focus(), 60);
}

// Open edit modal
function openEditTaskModal(id) {
    clearValidationErrors();
    const task = tasks.find(t => t.id == id);
    if (!task) return;
    
    document.getElementById('modalTitle').textContent = "Edit task";
    document.getElementById('taskId').value = task.id;
    document.getElementById('taskName').value = task.name || "";
    document.getElementById('taskCategory').value = task.category || "Health & Vitality";
    document.getElementById('taskDescription').value = task.description || "";
    document.getElementById('taskType').value = task.type || "interval";
    
    const duration = task.durationMinutes || 15;
    document.getElementById('taskDuration').value = duration;
    const durInput = document.getElementById('taskDurationInput');
    if (durInput) durInput.value = duration;
    
    const dueTimeInput = document.getElementById('taskDueTime');
    if (dueTimeInput) dueTimeInput.value = task.dueTime || "";
    
    const timeSlot = task.timeSlot || 'anytime';
    document.getElementById('taskTimeSlot').value = timeSlot;
    document.querySelectorAll('#timeSlotGrid button').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-slot') === timeSlot);
    });
    syncWhenUI();

    syncTaskNameUI(task.category);
    
    // Sync Category Step 1 button active state
    document.querySelectorAll('.wizard-step[data-step="1"] .wizard-option-btn').forEach(btn => {
        if (btn.getAttribute('data-value') === task.category) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    // Sync Frequency Step 3 button active state
    document.querySelectorAll('.wizard-step[data-step="3"] .wizard-option-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (task.type === 'interval') {
        const interval = task.intervalDays || 1;
        document.getElementById('taskInterval').value = interval;
        document.getElementById('taskDueDate').value = "";
        
        if (interval === 1) {
            const btn = document.querySelector('.wizard-step[data-step="3"] .wizard-option-btn[data-freq-val="1"]');
            if (btn) btn.classList.add('active');
            intervalGroup.classList.add('hidden');
            dueDateGroup.classList.add('hidden');
        } else if (interval === 7) {
            const btn = document.querySelector('.wizard-step[data-step="3"] .wizard-option-btn[data-freq-val="7"]');
            if (btn) btn.classList.add('active');
            intervalGroup.classList.add('hidden');
            dueDateGroup.classList.add('hidden');
        } else if (interval === 30) {
            const btn = document.querySelector('.wizard-step[data-step="3"] .wizard-option-btn[data-freq-val="30"]');
            if (btn) btn.classList.add('active');
            intervalGroup.classList.add('hidden');
            dueDateGroup.classList.add('hidden');
        } else {
            const btn = document.getElementById('btnCustomDays');
            if (btn) btn.classList.add('active');
            intervalGroup.classList.remove('hidden');
            dueDateGroup.classList.add('hidden');
        }
    } else {
        const dStr = (task.dueDate && typeof task.dueDate === 'string')
            ? task.dueDate.split('T')[0]
            : (task.dueDate && task.dueDate.value ? String(task.dueDate.value).split('T')[0] : "");
        document.getElementById('taskDueDate').value = dStr;
        document.getElementById('taskInterval').value = "1";
        
        const btn = document.getElementById('btnFixedDate');
        if (btn) btn.classList.add('active');
        intervalGroup.classList.add('hidden');
        dueDateGroup.classList.remove('hidden');
    }
    
    const notifyPref = task.notifyPref || task.notifyPreference || 'digest';
    document.getElementById('taskNotify').value = notifyPref;
    
    document.querySelectorAll('.wizard-step[data-step="4"] .wizard-option-btn').forEach(btn => {
        if (btn.getAttribute('data-value') === notifyPref) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    setCommitmentSwitch(!!task.isCommitment);

    // Editing an existing task opens "More" - by definition the person came
    // here to change something, and half of what there is to change is inside.
    const more = document.getElementById('taskMore');
    if (more) more.open = true;

    showStep(1);
    document.getElementById('modalTitle').textContent = 'Edit task';
    openModal('Edit task');
}

// Close modal
// Dialog plumbing shared by the create and edit paths.
let releaseModalFocus = null;

function openModal(announceAs) {
    modal.classList.add('open');
    modal.removeAttribute('aria-hidden');
    const dialog = document.getElementById('taskModalDialog');
    if (window.BokeaA11y && dialog) {
        releaseModalFocus = window.BokeaA11y.trapFocus(dialog, { initialFocus: '#modalTitle' });
    }
    if (announceAs) announce(announceAs + ' dialog opened. Press Escape to close.');
}

function closeModal() {
    if (!modal.classList.contains('open')) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    if (releaseModalFocus) {
        releaseModalFocus(true);
        releaseModalFocus = null;
    }
}

// Escape closes the task dialog. The tour installs its own handler in capture
// phase, so this only fires when the tour is not the thing on screen.
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (window.BokeaTour && window.BokeaTour.isActive()) return;
    if (modal && modal.classList.contains('open')) {
        e.preventDefault();
        closeModal();
        return;
    }
    const calOverlay = document.getElementById('calDayOverlay');
    if (calOverlay && calOverlay.classList.contains('open')) {
        e.preventDefault();
        calCloseDay();
        return;
    }
    // Escape also closes the topbar menus.
    ['dropdownMenuBox', 'notificationMenuBox'].forEach(id => {
        const menu = document.getElementById(id);
        if (menu && menu.classList.contains('show')) {
            menu.classList.remove('show');
            const trigger = id === 'dropdownMenuBox'
                ? document.getElementById('profileAvatarBox')
                : document.getElementById('notificationBellBox');
            if (trigger) trigger.focus();
        }
    });
});


// Form Submission (Add or Edit)
taskForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('taskId').value;
    const name = document.getElementById('taskName').value.trim();
    const category = document.getElementById('taskCategory').value;
    const description = document.getElementById('taskDescription').value.trim();
    const type = document.getElementById('taskType').value;
    const intervalDays = document.getElementById('taskInterval').value;
    const dueDate = document.getElementById('taskDueDate').value;
    const dueTime = document.getElementById('taskDueTime') ? document.getElementById('taskDueTime').value : null;
    const timeSlot = document.getElementById('taskTimeSlot') ? document.getElementById('taskTimeSlot').value : 'anytime';
    const durationMinutes = document.getElementById('taskDurationInput') ? (parseInt(document.getElementById('taskDurationInput').value) || 15) : 15;
    const notifyPref = document.getElementById('taskNotify') ? document.getElementById('taskNotify').value : 'digest';
    
    if (!name) {
        showToast("Task name is required", "error");
        return;
    }
    
    if (type === 'fixed' && !dueDate) {
        showToast("Due date is required for fixed date tasks", "error");
        return;
    }
    
    const payload = {
        name,
        category,
        description,
        type,
        intervalDays: type === 'interval' ? parseInt(intervalDays) || 1 : null,
        dueDate: type === 'fixed' ? dueDate : null,
        dueTime: dueTime || null,
        timeSlot: timeSlot || 'anytime',
        durationMinutes: durationMinutes || 15,
        isCommitment: commitmentSwitchOn(),
        notifyPref: notifyPref || 'digest'
    };

    const askedSlot = timeSlot;

    try {
        let savedTask = null;
        if (id) {
            // Edit
            savedTask = await apiRequest(`/tasks/${id}`, 'PUT', payload);
            showToast("Saved.");
        } else {
            // Create
            savedTask = await apiRequest('/tasks', 'POST', payload);
            showToast("Added.");
        }
        
        // Save duration to localStorage
        const taskObj = savedTask || { id: id };
        if (taskObj && taskObj.id) {
            const durations = JSON.parse(localStorage.getItem('bokea_task_durations') || '{}');
            durations[taskObj.id] = durationMinutes;
            localStorage.setItem('bokea_task_durations', JSON.stringify(durations));
        }
        
        closeModal();
        await loadDashboardData();
        // Filing something into a part of the day is the first moment those
        // words have to mean particular hours, so that is when we ask.
        maybeAskForSchedule(askedSlot);
    } catch (err) {
        console.error("Error saving task.", err);
        showToast("Could not save that. Nothing was lost \u2014 try again.", "error");
    }
});

// 8. Toast Notifications
// opts.action = { label, onClick } puts a single button in the toast. That
// button is the whole undo story: the actions in this app fire on one tap,
// and mis-tapping a row is the commonest input error the audience has.
function showToast(message, type = 'success', opts) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    const o = opts || {};

    toast.textContent = '';
    toast.className = 'toast';

    const text = document.createElement('span');
    text.className = 'toast-text';
    text.textContent = message;
    toast.appendChild(text);

    if (o.action && typeof o.action.onClick === 'function') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'toast-action';
        btn.textContent = o.action.label || 'Undo';
        btn.addEventListener('click', () => {
            clearTimeout(showToast._timer);
            toast.classList.add('hidden');
            o.action.onClick();
        });
        toast.appendChild(btn);
        // The toast is normally hidden from assistive tech because the words
        // are announced through the shared live region. A button inside it has
        // to be reachable, so this one is not hidden and says what it undoes.
        btn.setAttribute('aria-label', `${btn.textContent}: ${message}`);
    }
    
    if (type === 'error') {
        toast.classList.add('toast-error');
    } else if (type === 'warning') {
        toast.classList.add('toast-error'); // Reuse styling with variations if needed
        toast.style.borderColor = 'var(--color-amber)';
        toast.style.boxShadow = '0 10px 30px rgba(255, 183, 3, 0.2)';
    }
    
    toast.classList.remove('hidden');

    // The words go through the shared live region so they are announced
    // exactly once; the toast itself stays out of the reading order.
    announce(message, type === 'error');

    // Auto-dismiss. Errors stay longer: 3 seconds is not enough to read and act
    // on something that went wrong.
    clearTimeout(showToast._timer);
    // An offer to undo has to outlast the moment of realising you need it.
    const life = o.action ? 8000 : (type === 'error' ? 6000 : 3500);
    showToast._timer = setTimeout(() => {
        toast.classList.add('hidden');
        if (typeof o.onExpire === 'function') o.onExpire();
    }, life);
}

// 9. Startup & Event Listeners Wiring

document.addEventListener('DOMContentLoaded', () => {
    // Welcome Screen & Auth logic
    const welcomeScreen = document.getElementById('welcomeScreen');
    const loginFormSection = document.getElementById('loginFormSection');
    const registerFormSection = document.getElementById('registerFormSection');
    const showRegisterLink = document.getElementById('showRegisterLink');
    const showLoginLink = document.getElementById('showLoginLink');
    const authErrorMsg = document.getElementById('authErrorMsg');
    const dashboardGreeting = document.getElementById('dashboardGreeting');
    const dashboardUserName = document.getElementById('userName');

    function updateGreetings(name) {
        const hour = new Date().getHours();
        let greetText = "Good night";
        if (hour >= 5 && hour < 12) {
            greetText = "Good morning";
        } else if (hour >= 12 && hour < 17) {
            greetText = "Good afternoon";
        } else if (hour >= 17 && hour < 21) {
            greetText = "Good evening";
        }
        
        // Only ever show the name the user actually gave us. If there isn't one,
        // greet them without a name rather than inventing a placeholder person.
        const displayName = (typeof name === 'string' ? name.trim() : '');
        const firstName = displayName ? displayName.split(' ')[0] : '';
        const initial = firstName ? firstName.charAt(0).toUpperCase() : '';

        if (dashboardGreeting) dashboardGreeting.textContent = greetText;
        if (dashboardUserName) {
            dashboardUserName.textContent = firstName;
            // Drop the comma when there is no name to put after it.
            const comma = document.getElementById('greetingComma');
            if (comma) comma.hidden = !firstName;
        }

        const sidebarUser = document.querySelector('.username');
        if (sidebarUser) sidebarUser.textContent = displayName || 'Your account';
        const avatar = document.querySelector('.avatar');
        if (avatar) {
            avatar.textContent = initial;
            avatar.setAttribute('aria-hidden', 'true');
        }
        const topAvatar = document.querySelector('.profile-avatar-initial');
        if (topAvatar) topAvatar.textContent = initial;

        // The picture, wherever the person is shown. Read here rather than only
        // on the profile screen, so it is already there on the first paint.
        applyAvatarEverywhere(readLocalProfile().avatarDataUrl || '');
        const profileBox = document.getElementById('profileAvatarBox');
        if (profileBox) {
            profileBox.setAttribute('aria-label', displayName
                ? `Account menu for ${displayName}`
                : 'Account menu');
        }
    }

    function calculateSleepDuration(bedTime, wakeTime) {
        if (!bedTime || !wakeTime) return 0;
        const [bedH, bedM] = bedTime.split(':').map(Number);
        const [wakeH, wakeM] = wakeTime.split(':').map(Number);
        let bedMinutes = bedH * 60 + bedM;
        let wakeMinutes = wakeH * 60 + wakeM;
        let diff = wakeMinutes - bedMinutes;
        if (diff < 0) diff += 24 * 60;
        return diff / 60;
    }

    function updateSleepHealthMeter(bedTimeEl, wakeTimeEl, textEl, labelEl, barEl, tipsEl) {
        const duration = calculateSleepDuration(bedTimeEl.value, wakeTimeEl.value);
        textEl.textContent = `Sleep Duration: ${duration.toFixed(1)} hours`;
        labelEl.className = 'health-badge';
        barEl.className = 'meter-bar-fill';
        
        if (duration >= 7 && duration <= 9) {
            labelEl.textContent = 'Optimal Sleep';
            labelEl.classList.add('health-optimal');
            barEl.classList.add('health-optimal');
            barEl.style.width = '100%';
            tipsEl.textContent = '7 to 9 hours is the ideal sleep window for adults to maintain metabolic and cognitive health.';
        } else if ((duration >= 6 && duration < 7) || (duration > 9 && duration <= 10)) {
            labelEl.textContent = 'Marginal Sleep';
            labelEl.classList.add('health-warning');
            barEl.classList.add('health-warning');
            barEl.style.width = '70%';
            tipsEl.textContent = 'Sleeping slightly less or more than recommended can lead to midday fatigue or subtle cognitive changes.';
        } else {
            labelEl.textContent = 'Unhealthy Sleep';
            labelEl.classList.add('health-danger');
            barEl.classList.add('health-danger');
            barEl.style.width = '40%';
            if (duration < 6) {
                tipsEl.textContent = 'Less than 6 hours of sleep puts you at high risk of chronic sleep deprivation, reduced cognitive focus, and high stress levels.';
            } else {
                tipsEl.textContent = 'Oversleeping (more than 10 hours) can be a sign of poor sleep quality, sleep apnea, or underlying fatigue.';
            }
        }
    }

    function initSetupPageListeners() {
        const setupBedTime = document.getElementById('setupBedTime');
        const setupWakeUpTime = document.getElementById('setupWakeUpTime');
        const textEl = document.getElementById('sleepDurationText');
        const labelEl = document.getElementById('sleepHealthLabel');
        const barEl = document.getElementById('sleepHealthBar');
        const tipsEl = document.getElementById('sleepHealthTips');

        if (setupBedTime && setupWakeUpTime && textEl && labelEl && barEl && tipsEl) {
            const triggerUpdate = () => {
                updateSleepHealthMeter(setupBedTime, setupWakeUpTime, textEl, labelEl, barEl, tipsEl);
            };
            setupBedTime.addEventListener('input', triggerUpdate);
            setupWakeUpTime.addEventListener('input', triggerUpdate);
            triggerUpdate();
        }

        const setupForm = document.getElementById('setupForm');

        // Shared submit logic used by both the real form submit and the "Skip" shortcut.
        // Skipping just accepts whatever defaults are currently filled into the fields,
        // so the user isn't forced to review/adjust every field before they can start.
        const submitSetup = async () => {
            const bedTime = document.getElementById('setupBedTime').value || '22:30';
            const wakeUpTime = document.getElementById('setupWakeUpTime').value || '06:30';
            const workStartTime = document.getElementById('setupWorkStart').value || '09:00';
            const workEndTime = document.getElementById('setupWorkEnd').value || '17:00';

            let workDays = [];
            document.querySelectorAll('input[name="setupWorkDays"]:checked').forEach(cb => {
                workDays.push(cb.value);
            });
            if (workDays.length === 0) {
                workDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
            }

            const payload = {
                wakeUpTime,
                bedTime,
                workStartTime,
                workEndTime,
                workDays
            };

            try {
                await apiRequest('/auth/setup', 'POST', payload);
                localStorage.setItem('bokea_setup_completed', 'true');
                localStorage.setItem('bokea_wakeup_time', wakeUpTime);
                localStorage.setItem('bokea_bed_time', bedTime);
                localStorage.setItem('bokea_work_start', workStartTime);
                localStorage.setItem('bokea_work_end', workEndTime);
                localStorage.setItem('bokea_work_days', JSON.stringify(workDays));

                const localId = localStorage.getItem('bokea_local_account_id');
                if (localId) localStorage.setItem(`bokea_local_setup_${localId}`, 'true');

                const setupScreen = document.getElementById('setupScreen');
                setupScreen.classList.add('hidden');
                setupScreen.setAttribute('aria-hidden', 'true');

                const appContainer = document.querySelector('.app-container');
                if (appContainer) {
                    appContainer.style.display = 'flex';
                    appContainer.removeAttribute('aria-hidden');
                }

                refreshStorageScope();
                initLocalStorage();
                updateGreetings(localStorage.getItem('bokea_username'));
                await loadDashboardData();
                initPushNotificationSettings();
                if (typeof window.maybeStartTutorial === 'function') {
                    window.maybeStartTutorial();
                }
                // Put the keyboard back where the person was working.
                const back = document.getElementById('mainContent');
                if (back) back.focus();
                return true;
            } catch (err) {
                console.error("Setup failed", err);
                showToast("Failed to complete setup", "error");
                announce("Setup could not be saved. Please try again.", true);
                return false;
            }
        };

        if (setupForm) {
            setupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (await submitSetup()) {
                    showToast("Profile set up completed!");
                }
            });
        }

        const skipSetupBtn = document.getElementById('skipSetupBtn');
        if (skipSetupBtn) {
            skipSetupBtn.addEventListener('click', async () => {
                if (await submitSetup()) {
                    showToast("Setup skipped - you can change these anytime in Settings.");
                }
            });
        }
    }

    async function checkAuthToken() {
        if (supabaseClient) {
            try {
                const { data: sessionData } = await supabaseClient.auth.getSession();
                const session = sessionData?.session;
                if (session?.user) {
                    localStorage.setItem('bokea_auth_token', session.access_token);
                    localStorage.setItem('bokea_user_id', session.user.id);
                    if (!localStorage.getItem('bokea_username')) {
                        const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', session.user.id).single();
                        const name = profile?.first_name || session.user.user_metadata?.first_name || session.user.email.split('@')[0];
                        localStorage.setItem('bokea_username', name);
                        localStorage.setItem('bokea_setup_completed', profile?.is_setup_completed ? 'true' : 'false');
                        if (profile?.wake_up_time) localStorage.setItem('bokea_wakeup_time', profile.wake_up_time);
                        if (profile?.bed_time) localStorage.setItem('bokea_bed_time', profile.bed_time);
                        if (profile?.work_start_time) localStorage.setItem('bokea_work_start', profile.work_start_time);
                        if (profile?.work_end_time) localStorage.setItem('bokea_work_end', profile.work_end_time);
                        if (profile?.work_days) localStorage.setItem('bokea_work_days', JSON.stringify(profile.work_days));
                    }
                } else {
                    // No session on the server means no session here. The
                    // browser does not get to disagree with it.
                    localStorage.removeItem('bokea_auth_token');
                    localStorage.removeItem('bokea_user_id');
                    localStorage.removeItem('bokea_username');
                }
            } catch (e) {
                // A refresh that failed to complete is not proof the session is
                // over. Leave it alone; the next request to the server will be
                // turned away if it really has expired.
                console.warn("Error checking Supabase session:", e);
            }
        } else {
            // No server to confirm anything with. A token sitting in this
            // browser is a claim, not a session, and claims do not open the app.
            localStorage.removeItem('bokea_auth_token');
            localStorage.removeItem('bokea_user_id');
            localStorage.removeItem('bokea_username');
        }

        clearStaleLocalSession();

        const token = localStorage.getItem('bokea_auth_token');
        const savedName = localStorage.getItem('bokea_username');
        const setupCompleted = localStorage.getItem('bokea_setup_completed') === 'true';
        const appContainer = document.querySelector('.app-container');

        refreshStorageScope();
        initLocalStorage();

        const setupScreen = document.getElementById('setupScreen');

        // The schedule form used to stand between signing up and seeing the
        // app: four times and a seven-checkbox weekday pattern, asked before
        // anybody knew what the answers were for. A token is now enough to
        // get in; the schedule is asked for the first time it decides
        // something (see maybeAskForSchedule), and lives in Settings after that.
        if (token) {
            updateGreetings(savedName);
            welcomeScreen.classList.add('hidden');
            welcomeScreen.setAttribute('aria-hidden', 'true');
            setupScreen.classList.add('hidden');
            setupScreen.setAttribute('aria-hidden', 'true');
            if (appContainer) {
                appContainer.style.display = 'flex';
                appContainer.removeAttribute('aria-hidden');
            }
            initSetupPageListeners();
            maybeStartTutorial();
        } else {
            if (appContainer) {
                appContainer.style.display = 'none';
                appContainer.setAttribute('aria-hidden', 'true');
            }
            welcomeScreen.classList.remove('hidden');
            welcomeScreen.removeAttribute('aria-hidden');
            setupScreen.classList.add('hidden');
            setupScreen.setAttribute('aria-hidden', 'true');
            if (!firstPaint) focusFirstHeading(welcomeScreen);
        }
        firstPaint = false;
    }
    let firstPaint = true;

    // Starts the guided tour the first time an account reaches the dashboard.
    // Deferred a tick so the first render has happened and the tour has real
    // elements to point at.
    function maybeStartTutorial() {
        if (!window.BokeaTour) return;
        const key = `bokea_tutorial_done_${storageScope}`;
        if (localStorage.getItem(key) === 'true') return;
        window.setTimeout(() => {
            if (localStorage.getItem(key) === 'true') return;
            window.BokeaTour.start({ reason: 'first-run' });
        }, 700);
    }
    window.maybeStartTutorial = maybeStartTutorial;

    // Brand click redirects to Home page
    const brandContainer = document.getElementById('brandHomeBtn') || document.querySelector('.brand');
    if (brandContainer) {
        brandContainer.addEventListener('click', () => {
            const homeNavItem = document.querySelector('.nav-menu .nav-item[data-tab="home"]');
            if (homeNavItem) {
                homeNavItem.click();
            }
        });
    }

    // Toggle Forms
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormSection.classList.add('hidden');
        registerFormSection.classList.remove('hidden');
        authErrorMsg.classList.add('hidden');
    });

    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormSection.classList.add('hidden');
        loginFormSection.classList.remove('hidden');
        authErrorMsg.classList.add('hidden');
    });

    // Helper to migrate local/guest tasks to Supabase when an account is created or accessed
    // Bringing offline work into a cloud account is the user's decision, not a
    // side effect of signing in. We only offer it for tasks they actually typed
    // (examples added from the tutorial are excluded), and only after they say yes.
    async function migrateLocalTasksToSupabase(userId, { ask = true } = {}) {
        if (!supabaseClient || !userId) return;
        try {
            const guestScope = 'guest';
            const localTasksRaw = localStorage.getItem(`bokea_tasks_${guestScope}`);
            if (!localTasksRaw) return;
            let localTasks = JSON.parse(localTasksRaw);
            if (!Array.isArray(localTasks)) return;
            localTasks = localTasks.filter(t => t && t.isSample !== true && (t.name || t.title));
            if (localTasks.length === 0) return;

            if (ask) {
                const count = localTasks.length;
                const proceed = window.confirm(
                    `You created ${count} task${count === 1 ? '' : 's'} before signing in. ` +
                    `Move ${count === 1 ? 'it' : 'them'} into this account?\n\n` +
                    `Choose Cancel to start this account empty. Nothing will be deleted either way.`
                );
                if (!proceed) return;
            }
            
            // Fetch existing Supabase tasks for this user to avoid duplicate migration
            const { data: existingTasks } = await supabaseClient.from('tasks').select('id, title').eq('user_id', userId);
            const existingTitles = new Set((existingTasks || []).map(t => (t.title || '').trim().toLowerCase()));

            const sectorMap = {
                'Health & Vitality': 'HealthAndVitality',
                'Career & Finance': 'CareerAndFinance',
                'Relationships & Social': 'RelationshipsAndSocial',
                'Mind & Environment': 'MindAndEnvironment'
            };

            const rowsToInsert = [];
            for (const t of localTasks) {
                const title = (t.name || t.title || '').trim();
                if (!title || existingTitles.has(title.toLowerCase())) continue;

                const sector = sectorMap[t.category] || 'HealthAndVitality';
                const intervalType = t.type === 'interval' ? 'IntervalBased' : 'FixedDate';
                rowsToInsert.push({
                    user_id: userId,
                    title: title,
                    description: t.description || null,
                    sector: sector,
                    interval_type: intervalType,
                    interval_days: t.type === 'interval' ? (parseInt(t.intervalDays) || 1) : null,
                    due_date: t.dueDate || null,
                    due_time: t.dueTime || null,
                    time_slot: t.timeSlot || 'anytime',
                    duration_minutes: t.durationMinutes || 15,
                    notify_pref: t.notifyPref || 'digest',
                    is_archived: false,
                    state: t.state || 'Green',
                    last_completed_at: t.lastCompleted || null,
                    snoozed_until: t.snoozeUntil || null,
                    display_order: 0
                });
            }

            if (rowsToInsert.length > 0) {
                await supabaseClient.from('tasks').insert(rowsToInsert);
                // Migrated once, then removed from the guest bucket so the next
                // account created on this device does not pick them up again.
                localStorage.removeItem(`bokea_tasks_${guestScope}`);
                localStorage.removeItem(`bokea_history_${guestScope}`);
                console.log(`Migrated ${rowsToInsert.length} offline tasks to Supabase user ${userId}`);
            }
        } catch (e) {
            console.warn("Error migrating offline tasks to Supabase:", e);
        }
    }

    // Whether an email is real, whether a password matches it, whether an
    // address is already taken, how long a password has to be: every one of
    // those is a question only the server can answer, so none of them are
    // asked here. The browser collects what was typed, hands it over, and
    // repeats what comes back. It never decides, and it never lets anyone in
    // on its own say-so.
    function showAuthError(message, tone) {
        authErrorMsg.textContent = message;
        authErrorMsg.style.color = tone === 'success' ? '#10b981' : '';
        authErrorMsg.classList.remove('hidden');
    }

    // With no server to ask, there is no honest way to sign anyone in. Say that
    // plainly rather than falling back to letting them through.
    function authBackendReady() {
        if (supabaseClient) return true;
        showAuthError("Bokeà cannot reach its server, so signing in is not possible right now. If you are running your own copy, add your Supabase URL and key to js/config.js.");
        return false;
    }

    async function storePasswordCredentials(formEl, username, password) {
        if (!window.PasswordCredential || !navigator.credentials || !navigator.credentials.store) return;
        try {
            let cred = null;
            if (formEl && formEl instanceof HTMLFormElement) {
                try {
                    cred = new PasswordCredential(formEl);
                } catch (_) {}
            }
            if (!cred) {
                cred = new PasswordCredential({
                    id: username,
                    password: password,
                    name: username
                });
            }
            if (cred) {
                await navigator.credentials.store(cred);
            }
        } catch (credErr) {
            console.debug("Credential storage note:", credErr);
        }
    }

    // Login
    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        const email = document.getElementById('loginEmailInput').value.trim();
        const password = document.getElementById('loginPasswordInput').value;
        if (!authBackendReady()) return;
        // Not a judgement about the credentials - just no reason to make the
        // server answer a question nobody has finished asking.
        if (!email || !password) {
            showAuthError("Fill in your email and password.");
            return;
        }

        const loginBtn = document.getElementById('loginBtn');
        const origBtnText = loginBtn ? loginBtn.textContent : '';
        if (loginBtn) {
            loginBtn.disabled = true;
            loginBtn.textContent = 'Logging in...';
        }

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) {
                if (loginBtn) {
                    loginBtn.disabled = false;
                    loginBtn.textContent = origBtnText;
                }
                // Whatever was wrong, the server is the one that knows it.
                showAuthError(error.message || "We could not sign you in.");
                return;
            }

            // Prompt browser password manager to store/update credentials
            await storePasswordCredentials(loginFormSection, email, password);

            const user = data.user;
            // Anything left on this device from before accounts were required
            // is still the user's work. Offer to bring it in, once, with a yes.
            await migrateLocalTasksToSupabase(user.id);

            const { data: profile } = await supabaseClient.from('profiles').select('*').eq('id', user.id).single();
            const firstName = profile?.first_name || user.user_metadata?.first_name || email.split('@')[0];

            localStorage.setItem('bokea_auth_token', data.session.access_token);
            localStorage.setItem('bokea_user_id', user.id);
            localStorage.setItem('bokea_username', firstName);
            localStorage.setItem('bokea_setup_completed', profile?.is_setup_completed ? 'true' : 'false');
            if (profile?.has_completed_tutorial) {
                localStorage.setItem(`bokea_tutorial_done_u_${String(user.id).replace(/[^a-zA-Z0-9_-]/g, '')}`, 'true');
            }
            if (profile?.wake_up_time) localStorage.setItem('bokea_wakeup_time', profile.wake_up_time);
            if (profile?.bed_time) localStorage.setItem('bokea_bed_time', profile.bed_time);
            if (profile?.work_start_time) localStorage.setItem('bokea_work_start', profile.work_start_time);
            if (profile?.work_end_time) localStorage.setItem('bokea_work_end', profile.work_end_time);
            if (profile?.work_days) {
                localStorage.setItem('bokea_work_days', JSON.stringify(profile.work_days));
            }
            setTimeout(() => {
                window.location.reload();
            }, 100);
        } catch (err) {
            if (loginBtn) {
                loginBtn.disabled = false;
                loginBtn.textContent = origBtnText;
            }
            showAuthError("We could not reach the server: " + (err.message || "network error") + ". Please try again.");
        }
    };

    if (loginFormSection) {
        loginFormSection.addEventListener('submit', handleLogin);
    }

    // Register
    const handleRegister = async (e) => {
        if (e) e.preventDefault();
        const firstName = document.getElementById('registerNameInput').value.trim();
        const email = document.getElementById('registerEmailInput').value.trim();
        const password = document.getElementById('registerPasswordInput').value;
        if (!authBackendReady()) return;
        if (!email || !password || !firstName) {
            showAuthError("Fill in your name, email and password.");
            return;
        }

        const registerBtn = document.getElementById('registerBtn');
        const origBtnText = registerBtn ? registerBtn.textContent : '';
        if (registerBtn) {
            registerBtn.disabled = true;
            registerBtn.textContent = 'Creating account...';
        }

        try {
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,
                options: {
                    data: { first_name: firstName }
                }
            });

            if (error) {
                if (registerBtn) {
                    registerBtn.disabled = false;
                    registerBtn.textContent = origBtnText;
                }
                // Address already taken, password too weak, address rejected:
                // the server's rules, stated in the server's words.
                showAuthError(error.message || "We could not create your account.");
                return;
            }

            // Prompt browser password manager to store credentials
            await storePasswordCredentials(registerFormSection, email, password);

            // No session with a new account means the address has to be proved
            // before it becomes one. That check belongs to the server, and the
            // app stays on this screen until the server says otherwise.
            if (!data.session) {
                if (registerBtn) {
                    registerBtn.disabled = false;
                    registerBtn.textContent = origBtnText;
                }
                showAuthError("Account created. Check your email and confirm your address, then log in.", 'success');
                return;
            }

            localStorage.setItem('bokea_auth_token', data.session.access_token);
            localStorage.setItem('bokea_user_id', data.session.user.id);
            localStorage.setItem('bokea_username', firstName);
            localStorage.setItem('bokea_setup_completed', 'false');
            refreshStorageScope();
            // Brand new account: start it empty, then ask before moving
            // anything this device was holding into it.
            clearScopedStorage();
            initLocalStorage();
            await migrateLocalTasksToSupabase(data.session.user.id);
            setTimeout(() => {
                window.location.reload();
            }, 100);
        } catch (err) {
            if (registerBtn) {
                registerBtn.disabled = false;
                registerBtn.textContent = origBtnText;
            }
            showAuthError("We could not reach the server: " + (err.message || "network error") + ". Please try again.");
        }
    };

    if (registerFormSection) {
        registerFormSection.addEventListener('submit', handleRegister);
    }


    window.logoutUser = async function() {
        if (supabaseClient) {
            try {
                await supabaseClient.auth.signOut();
            } catch (e) {
                console.warn("Supabase signOut error:", e);
            }
        }
        // Clear this account's data off the device before dropping the session,
        // so whoever signs in next starts from a genuinely empty app.
        refreshStorageScope();
        clearScopedStorage();

        localStorage.removeItem('bokea_auth_token');
        localStorage.removeItem('bokea_user_id');
        localStorage.removeItem('bokea_local_account_id');
        localStorage.removeItem('bokea_username');
        localStorage.removeItem('bokea_setup_completed');
        localStorage.removeItem('bokea_wakeup_time');
        localStorage.removeItem('bokea_bed_time');
        localStorage.removeItem('bokea_work_start');
        localStorage.removeItem('bokea_work_end');
        localStorage.removeItem('bokea_work_days');

        // An empty guest bucket is not data, but it is still clutter that
        // suggests the device remembers something. Drop it too.
        ['bokea_tasks_guest', 'bokea_history_guest'].forEach(key => {
            const raw = localStorage.getItem(key);
            if (raw === null || raw === '[]') localStorage.removeItem(key);
        });

        setStorageScope('guest');
        if (typeof window.resetProfileSync === 'function') window.resetProfileSync();
        
        // Immediately reset UI visibility to prevent showing default unstyled/previous state
        const welcomeScreen = document.getElementById('welcomeScreen');
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        const setupScreen = document.getElementById('setupScreen');
        if (setupScreen) setupScreen.classList.add('hidden');
        
        // Clear input values
        const loginEmail = document.getElementById('loginEmailInput');
        const loginPass = document.getElementById('loginPasswordInput');
        const regName = document.getElementById('registerNameInput');
        const regEmail = document.getElementById('registerEmailInput');
        const regPass = document.getElementById('registerPasswordInput');
        if (loginEmail) loginEmail.value = '';
        if (loginPass) loginPass.value = '';
        if (regName) regName.value = '';
        if (regEmail) regEmail.value = '';
        if (regPass) regPass.value = '';

        window.location.reload();
    };

    checkAuthToken();

    // Profile Dropdown Toggle
    const profileAvatarBox = document.getElementById('profileAvatarBox');
    const dropdownMenuBox = document.getElementById('dropdownMenuBox');
    const notificationBellBox = document.getElementById('notificationBellBox');
    const notificationMenuBox = document.getElementById('notificationMenuBox');

    profileAvatarBox.addEventListener('click', (e) => {
        e.stopPropagation();
        notificationMenuBox.classList.remove('show');
        dropdownMenuBox.classList.toggle('show');
    });

    notificationBellBox.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenuBox.classList.remove('show');
        notificationMenuBox.classList.toggle('show');
    });

    window.addEventListener('click', () => {
        if (dropdownMenuBox.classList.contains('show')) {
            dropdownMenuBox.classList.remove('show');
        }
        if (notificationMenuBox.classList.contains('show')) {
            notificationMenuBox.classList.remove('show');
        }
    });

    document.getElementById('dropdownHomeBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const homeNavItem = document.querySelector('.nav-menu .nav-item[data-tab="home"]');
        if (homeNavItem) {
            homeNavItem.click();
        }
        document.getElementById('dropdownMenuBox').classList.remove('show');
    });

    document.getElementById('dropdownSettingsBtn').addEventListener('click', (e) => {
        e.preventDefault();
        const settingsNavItem = document.querySelector('.nav-menu .nav-item[data-tab="settings"]');
        if (settingsNavItem) {
            settingsNavItem.click();
        }
        document.getElementById('dropdownMenuBox').classList.remove('show');
    });

    document.getElementById('dropdownSignOutBtn').addEventListener('click', (e) => {
        e.preventDefault();
        window.logoutUser();
    });

    // Notifications Clear All Action
    const clearNotificationsBtn = document.getElementById('clearNotificationsBtn');
    clearNotificationsBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const items = document.querySelectorAll('.notification-item');
        if (items.length === 0) return;
        
        // Trigger smooth slide out animation
        items.forEach(item => item.classList.add('clearing'));
        
        // Wait for CSS animation to finish (300ms)
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Snooze all Red and Amber tasks to green
        const warningTasks = tasks.filter(t => {
            const state = t.state || calculateTaskState(t);
            return state === 'Red' || state === 'Amber';
        });
        
        for (const task of warningTasks) {
            try {
                await apiRequest(`/tasks/${task.id}/snooze`, 'POST');
            } catch (err) {
                console.error("Failed to snooze task", task.id, err);
            }
        }
        
        await loadDashboardData();
        showToast("All notifications snoozed and cleared!");
    });

    // Dark Mode Toggle
    const themeToggleBtn = document.getElementById('themeToggleBtn');
    const themeToggleIcon = document.getElementById('themeToggleIcon');

    function setTheme(theme) {
        const isDark = theme === 'dark';
        document.body.classList.toggle('dark-theme', isDark);
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        themeToggleIcon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
        localStorage.setItem('bokea_theme', isDark ? 'dark' : 'light');

        // The button is a toggle: name it for what it does, and report its state.
        themeToggleBtn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
        const themeLabel = document.getElementById('themeToggleLabel');
        if (themeLabel) themeLabel.textContent = isDark ? 'Dark theme' : 'Light theme';
        themeToggleBtn.setAttribute('aria-label', isDark ? 'Dark theme, switch to light' : 'Light theme, switch to dark');

        updateThemeCardSelection(theme);
        refreshIcons();
    }

    themeToggleBtn.addEventListener('click', () => {
        document.body.classList.add('theme-transitioning');
        const isDark = document.body.classList.contains('dark-theme');
        setTheme(isDark ? 'light' : 'dark');
        announce(isDark ? 'Light theme on.' : 'Dark theme on.');
        setTimeout(() => {
            document.body.classList.remove('theme-transitioning');
        }, 500);
    });

    // Initial theme load
    const savedTheme = localStorage.getItem('bokea_theme');
    if (savedTheme === 'dark') {
        setTheme('dark');
    } else {
        setTheme('light');
    }

    // 1. Point storage at the signed-in account and make sure it has a store.
    refreshStorageScope();
    initLocalStorage();

    // 2. Load Dashboard values (only once past the welcome screen, so a signed-out
    //    visitor never triggers a request loop)
    const token = localStorage.getItem('bokea_auth_token');
    if (token) {
        loadDashboardData();
        initPushNotificationSettings();
    }
    
    // 3. Connect close button handler
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeModal);
    }
    
    // Close modal on clicking outside content
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // 6. Chart days toggles
    document.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.toggle-btn').forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            chartRange = parseInt(btn.getAttribute('data-range')) || 7;
            
            // Re-render graph and stats rate
            renderAnalyticsGraph();
            renderStats();
        });
    });
    
    // Helper to debounce high-frequency events
    function debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // 7. Window resize event to redraw responsive graph
    window.addEventListener('resize', debounce(() => {
        renderAnalyticsGraph();
    }, 150));
    
    // 8. Search input listener - debounced to prevent heavy reflows on each keystroke
    const taskSearchInput = document.getElementById('taskSearchInput');
    if (taskSearchInput) {
        taskSearchInput.addEventListener('input', debounce(() => {
            renderAllTasksGrid();
        }, 120));
    }

    // Sort select listener in Tasks View
    const taskSortSelect = document.getElementById('taskSortSelect');
    if (taskSortSelect) {
        taskSortSelect.addEventListener('change', () => {
            renderAllTasksGrid();
        });
    }

    // Segmented control + area narrowing + the cap, in Everything
    document.querySelectorAll('#taskSegBar .seg').forEach(seg => {
        seg.addEventListener('click', () => {
            document.querySelectorAll('#taskSegBar .seg').forEach(s => {
                s.classList.remove('active');
                s.setAttribute('aria-pressed', 'false');
            });
            seg.classList.add('active');
            seg.setAttribute('aria-pressed', 'true');
            tasksSegment = seg.getAttribute('data-seg') || 'now';
            tasksSegmentPinned = true;
            tasksUncapped = false;
            renderAllTasksGrid();
        });
    });

    const taskAreaSelect = document.getElementById('taskAreaSelect');
    if (taskAreaSelect) {
        taskAreaSelect.addEventListener('change', () => {
            tasksArea = taskAreaSelect.value || 'all';
            tasksUncapped = false;
            renderAllTasksGrid();
        });
    }

    const showMoreBtn = document.getElementById('showMoreBtn');
    if (showMoreBtn) {
        showMoreBtn.addEventListener('click', () => {
            tasksUncapped = true;
            renderAllTasksGrid();
        });
    }

    const capToggleBtn = document.getElementById('capToggleBtn');
    if (capToggleBtn) {
        capToggleBtn.addEventListener('click', () => {
            uiPrefs.capThree = !uiPrefs.capThree;
            tasksUncapped = false;
            saveUiPrefs();
            renderAllTasksGrid();
        });
    }


    // ======================================================================
    // 11b. Profile
    // ======================================================================
    // The one screen about the person rather than the work. It follows the
    // same rules as Settings, for the same reasons: no Save button to forget,
    // no field that is required, plain language, and a preview card that shows
    // the result so nobody has to picture it while typing.

    const PROFILE_FIELD_IDS = {
        firstName: 'profFirstName',
        lastName: 'profLastName',
        gender: 'profGender',
        dateOfBirth: 'profDob',
        bio: 'profBio',
        city: 'profCity',
        country: 'profCountry',
        timeZoneName: 'profTimeZone',
        phoneNumber: 'profPhone'
    };

    // Which acknowledgement belongs to which field, so "Saved" appears on the
    // panel you are actually looking at.
    const PROFILE_FLAGS = {
        profFirstName: 'profSavedName',
        profLastName: 'profSavedName',
        profPronouns: 'profSavedName',
        profPronounsCustom: 'profSavedName',
        profGender: 'profSavedName',
        profDob: 'profSavedAbout',
        profBio: 'profSavedAbout',
        profCity: 'profSavedPlace',
        profCountry: 'profSavedPlace',
        profTimeZone: 'profSavedPlace',
        profPhone: 'profSavedContact'
    };

    const PRONOUN_PRESETS = ['She/Her', 'He/Him', 'They/Them', 'She/They', 'He/They'];
    const GENDER_OPTIONS = ['Male', 'Female', 'Non-Binary', 'Prefer Not to Say'];

    function normalizePronouns(val) {
        if (!val) return '';
        const clean = String(val).trim();
        const match = PRONOUN_PRESETS.find(opt => opt.toLowerCase() === clean.toLowerCase());
        return match || clean;
    }

    function normalizeGender(val) {
        if (!val) return '';
        const clean = String(val).trim();
        const match = GENDER_OPTIONS.find(opt => opt.toLowerCase() === clean.toLowerCase());
        return match || clean;
    }

    // Gender is a short list now rather than a text box. Anything already
    // saved that is not on the list is put back on it rather than thrown
    // away: a field that silently empties itself when you next open the page
    // is worse than a list with one extra entry on it.
    function keepUnlistedOption(select, value) {
        if (!select || !value) return;
        const norm = normalizeGender(value);
        const known = Array.prototype.some.call(select.options, o => (o.value || '').toLowerCase() === norm.toLowerCase());
        if (known) return;
        const opt = document.createElement('option');
        opt.value = norm;
        opt.textContent = norm;
        select.appendChild(opt);
    }

    function profEl(id) { return document.getElementById(id); }

    // Age is derived every time it is shown and never stored. A stored age is
    // wrong for one day a year, every year.
    function ageFromDob(dob) {
        if (!dob) return null;
        const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
        if (!parts) return null;
        const year = Number(parts[1]), month = Number(parts[2]), day = Number(parts[3]);
        const birth = new Date(year, month - 1, day);
        if (birth.getFullYear() !== year || birth.getMonth() !== month - 1 || birth.getDate() !== day) return null;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (birth > today) return null;

        let age = today.getFullYear() - year;
        const hadBirthday = (today.getMonth() > birth.getMonth())
            || (today.getMonth() === birth.getMonth() && today.getDate() >= birth.getDate());
        if (!hadBirthday) age -= 1;
        return age >= 0 ? age : null;
    }

    function todayIso() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function deviceTimeZone() {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        } catch (e) {
            return '';
        }
    }

    // ---- one-time population of the long lists ----

    function fillTimeZoneSelect() {
        const select = profEl('profTimeZone');
        if (!select || select.dataset.filled === 'true') return;
        select.dataset.filled = 'true';

        let zones = [];
        try {
            // Not everywhere yet. Where it is missing, the device's own zone is
            // still offered, which is the answer almost everyone wants.
            if (typeof Intl.supportedValuesOf === 'function') {
                zones = Intl.supportedValuesOf('timeZone') || [];
            }
        } catch (e) {
            zones = [];
        }

        const device = deviceTimeZone();
        if (device && zones.indexOf(device) === -1) zones.unshift(device);
        if (!zones.length && device) zones = [device];

        const blank = document.createElement('option');
        blank.value = '';
        blank.textContent = device ? `Follow this device (${device})` : 'Follow this device';
        select.appendChild(blank);

        const frag = document.createDocumentFragment();
        zones.forEach(zone => {
            const opt = document.createElement('option');
            opt.value = zone;
            opt.textContent = zone.replace(/_/g, ' ');
            frag.appendChild(opt);
        });
        select.appendChild(frag);
    }

    // Country names come from the browser in the browser's own language rather
    // than from a hardcoded English list. The codes are ISO 3166-1 alpha-2.
    const COUNTRY_CODES = ('AD AE AF AG AL AM AO AR AT AU AZ BA BB BD BE BF BG BH BI BJ BN BO BR BS BT BW BY BZ ' +
        'CA CD CF CG CH CI CL CM CN CO CR CU CV CY CZ DE DJ DK DM DO DZ EC EE EG ER ES ET FI FJ FM FR GA GB GD ' +
        'GE GH GM GN GQ GR GT GW GY HN HR HT HU ID IE IL IN IQ IR IS IT JM JO JP KE KG KH KI KM KN KP KR KW KZ ' +
        'LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MG MH MK ML MM MN MR MT MU MV MW MX MY MZ NA NE NG NI NL ' +
        'NO NP NR NZ OM PA PE PG PH PK PL PT PW PY QA RO RS RU RW SA SB SC SD SE SG SI SK SL SM SN SO SR SS ST ' +
        'SV SY SZ TD TG TH TJ TL TM TN TO TR TT TV TZ UA UG US UY UZ VA VC VE VN VU WS YE ZA ZM ZW').split(' ');

    function fillCountryList() {
        const list = profEl('profCountryList');
        if (!list || list.dataset.filled === 'true') return;
        list.dataset.filled = 'true';

        let names = null;
        try {
            names = new Intl.DisplayNames(undefined, { type: 'region' });
        } catch (e) {
            names = null;
        }
        if (!names) return;

        const frag = document.createDocumentFragment();
        COUNTRY_CODES.forEach(code => {
            let label;
            try {
                label = names.of(code);
            } catch (e) {
                label = null;
            }
            if (!label || label === code) return;
            const opt = document.createElement('option');
            opt.value = label;
            frag.appendChild(opt);
        });
        list.appendChild(frag);
    }

    // ---- the picture ----

    // Squared off and shrunk here, in the browser, before it is stored
    // anywhere. A phone photo is several megabytes; an avatar is a thumbnail,
    // and there is no reason for the difference to reach the database.
    const AVATAR_SIZE = 256;

    function resizeToAvatar(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = () => reject(new Error('That file could not be read.'));
            reader.onload = () => {
                const img = new Image();
                img.onerror = () => reject(new Error('That file is not an image Bokeà can read.'));
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = AVATAR_SIZE;
                    canvas.height = AVATAR_SIZE;
                    const ctx = canvas.getContext('2d');

                    // White underneath, because a transparent PNG saved as JPEG
                    // would otherwise come back with a black background.
                    ctx.fillStyle = '#ffffff';
                    ctx.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);

                    // Centre crop: take the largest square the picture contains
                    // rather than squashing it into one.
                    const side = Math.min(img.width, img.height);
                    const sx = (img.width - side) / 2;
                    const sy = (img.height - side) / 2;
                    ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

                    try {
                        resolve(canvas.toDataURL('image/jpeg', 0.85));
                    } catch (e) {
                        reject(new Error('That picture could not be saved.'));
                    }
                };
                img.src = reader.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // The picture belongs everywhere the person is shown, not only on the
    // profile screen: the sidebar and the top bar are where you actually see it.
    function applyAvatarEverywhere(dataUrl) {
        const sidebar = document.querySelector('.avatar');
        if (sidebar) {
            sidebar.classList.toggle('has-photo', !!dataUrl);
            sidebar.style.backgroundImage = dataUrl ? `url("${dataUrl}")` : '';
        }
        const topBox = document.getElementById('profileAvatarBox');
        if (topBox) {
            topBox.classList.toggle('has-photo', !!dataUrl);
            topBox.style.backgroundImage = dataUrl ? `url("${dataUrl}")` : '';
        }
    }

    // ---- reading and writing ----

    function collectProfile() {
        const profile = {};
        Object.keys(PROFILE_FIELD_IDS).forEach(key => {
            const input = profEl(PROFILE_FIELD_IDS[key]);
            profile[key] = input ? input.value.trim() : '';
        });

        const select = profEl('profPronouns');
        const custom = profEl('profPronounsCustom');
        if (select && select.value === '__custom') {
            profile.pronouns = custom ? custom.value.trim() : '';
        } else {
            profile.pronouns = select ? select.value : '';
        }
        if (profile.pronouns) {
            profile.pronouns = normalizePronouns(profile.pronouns);
        }

        // The picture is not an input, so it is carried on the form itself.
        const form = profEl('profileForm');
        profile.avatarDataUrl = (form && form.dataset.avatar) || '';

        // displayName is what the card shows: the two name fields joined, or
        // whatever single one was filled in.
        profile.displayName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
        return profile;
    }

    function renderProfileCard(profile) {
        const first = (profile.firstName || '').trim();
        const shown = (profile.displayName || first || '').trim();

        const nameEl = profEl('profCardName');
        if (nameEl) nameEl.textContent = shown || 'Your account';

        const initialEl = profEl('profAvatarInitial');
        if (initialEl) initialEl.textContent = first ? first.charAt(0).toUpperCase() : '';

        const img = profEl('profAvatarImg');
        if (img) {
            if (profile.avatarDataUrl) {
                img.src = profile.avatarDataUrl;
                img.hidden = false;
                img.alt = 'Your picture';
            } else {
                img.removeAttribute('src');
                img.hidden = true;
            }
        }
        if (initialEl) initialEl.hidden = !!profile.avatarDataUrl;

        const pickLabel = profEl('profAvatarPickLabel');
        if (pickLabel) pickLabel.textContent = profile.avatarDataUrl ? 'Change picture' : 'Add a picture';
        const removeBtn = profEl('profAvatarRemoveBtn');
        if (removeBtn) removeBtn.hidden = !profile.avatarDataUrl;

        const pronounsEl = profEl('profCardPronouns');
        if (pronounsEl) {
            pronounsEl.textContent = normalizePronouns(profile.pronouns) || '';
            pronounsEl.hidden = !profile.pronouns;
        }

        // Age and place on one line, and only the parts that exist. An empty
        // profile shows an empty card rather than a row of dashes.
        const bits = [];
        const age = ageFromDob(profile.dateOfBirth);
        if (age !== null) bits.push(`${age}`);
        const place = [profile.city, profile.country].filter(Boolean).join(', ');
        if (place) bits.push(place);
        const metaEl = profEl('profCardMeta');
        if (metaEl) {
            metaEl.textContent = bits.join(' · ');
            metaEl.hidden = bits.length === 0;
        }

        const bioEl = profEl('profCardBio');
        if (bioEl) {
            bioEl.textContent = profile.bio || '';
            bioEl.hidden = !profile.bio;
        }

        applyAvatarEverywhere(profile.avatarDataUrl || '');
    }

    function renderProfileDerived(profile) {
        const age = ageFromDob(profile.dateOfBirth);
        const ageHint = profEl('profAgeHint');
        if (ageHint) {
            // Nothing to say until there is a date; a hint that only explains
            // itself is one more line to read past.
            ageHint.textContent = age === null ? '' : `That makes you ${age}.`;
        }

        const count = profEl('profBioCount');
        if (count) count.textContent = String((profile.bio || '').length);
    }

    // A date in the future is a typo, not a fact. Said next to the field, and
    // the field is not emptied — the fix is one keystroke from what was typed.
    function validateDob() {
        const input = profEl('profDob');
        const error = profEl('profDobError');
        if (!input || !error) return true;

        const value = input.value;
        let message = '';
        if (value) {
            if (value > todayIso()) {
                message = 'That day has not happened yet.';
            } else if (Number(value.slice(0, 4)) < 1900) {
                message = 'That year looks like a typo.';
            }
        }

        error.textContent = message;
        error.hidden = !message;
        input.setAttribute('aria-invalid', message ? 'true' : 'false');
        return !message;
    }

    let profileSaveTimer = null;

    async function persistProfile() {
        const profile = collectProfile();

        // This device first, always. A profile that only exists once the
        // network agrees is a profile that vanishes on a train.
        try {
            localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
        } catch (e) {
            // Almost always the quota, and almost always the picture.
            showToast('There is no room left in this browser to store that.', 'error');
            return false;
        }

        if (profile.firstName) {
            localStorage.setItem('bokea_username', profile.firstName);
        } else {
            localStorage.removeItem('bokea_username');
        }
        updateGreetings(profile.firstName);

        // The name lives in two places on screen. Keep the Settings copy in
        // step so the two never disagree about what you are called.
        const settingsName = document.getElementById('settingsNameInput');
        if (settingsName && settingsName.value.trim() !== profile.firstName) {
            settingsName.value = profile.firstName;
        }

        renderProfileCard(profile);
        renderProfileDerived(profile);

        try {
            await apiRequest('/auth/profile/about', 'PUT', profile);
            return true;
        } catch (err) {
            console.warn('Profile could not be saved to the account.', err);
            showToast('Saved on this device, but not to your account.', 'warning');
            return false;
        }
    }

    function requestProfileSave(sourceEl) {
        const flagId = sourceEl && PROFILE_FLAGS[sourceEl.id];
        const flag = flagId ? profEl(flagId) : null;

        clearTimeout(profileSaveTimer);
        profileSaveTimer = setTimeout(async () => {
            if (!validateDob()) return;
            const ok = await persistProfile();
            if (ok) {
                flashSaved(flag);
                if (typeof announce === 'function') announce('Saved.');
            }
        }, 400);
    }

    function loadProfileIntoForm() {
        fillTimeZoneSelect();
        fillCountryList();

        const profile = readLocalProfile();

        // A name typed on the Settings screen splits back into two here.
        if (!profile.lastName && profile.displayName) {
            const parts = profile.displayName.trim().split(/\s+/);
            const first = parts.shift() || '';
            if (!profile.firstName) profile.firstName = first;
            profile.lastName = parts.join(' ');
        }

        Object.keys(PROFILE_FIELD_IDS).forEach(key => {
            const input = profEl(PROFILE_FIELD_IDS[key]);
            if (input) input.value = profile[key] || '';
        });

        const dob = profEl('profDob');
        if (dob) dob.max = todayIso();

        // Assigning a value a <select> does not have silently blanks it, so
        // the old free-text answer has to be added before it is applied.
        const genderSelect = profEl('profGender');
        if (genderSelect) {
            const normalizedGender = normalizeGender(profile.gender || '');
            keepUnlistedOption(genderSelect, normalizedGender);
            genderSelect.value = normalizedGender;
        }

        const select = profEl('profPronouns');
        const customField = profEl('profPronounsCustomField');
        const custom = profEl('profPronounsCustom');
        const pronouns = profile.pronouns || '';
        if (select) {
            const norm = normalizePronouns(pronouns);
            if (!pronouns) {
                select.value = '';
            } else if (PRONOUN_PRESETS.indexOf(norm) !== -1) {
                select.value = norm;
            } else {
                select.value = '__custom';
                if (custom) custom.value = pronouns;
            }
        }
        if (customField) customField.hidden = !(select && select.value === '__custom');

        const form = profEl('profileForm');
        if (form) form.dataset.avatar = profile.avatarDataUrl || '';

        const emailEl = profEl('profEmail');
        const signedIn = Boolean(localStorage.getItem('bokea_auth_token'));
        if (emailEl) {
            emailEl.textContent = signedIn ? (profile.email || 'Loading…') : 'Signed out';
        }
        const emailHint = profEl('profEmailHint');
        if (emailHint && !signedIn) {
            emailHint.textContent = 'Log in again to see your account.';
        }

        const tzHint = profEl('profTimeZoneHint');
        if (tzHint) {
            const device = deviceTimeZone();
            tzHint.textContent = device ? `This device says ${device}.` : '';
        }

        renderProfileCard(collectProfile());
        renderProfileDerived(profile);
        validateDob();
        refreshIcons();

        if (signedIn) syncProfileFromAccount();
    }

    // The account is the copy that follows you between devices, so on opening
    // the screen it fills in anything this browser has never been told. It only
    // ever fills blanks: a value typed here half a second ago outranks whatever
    // the server had, and a slow reply must never overwrite it.
    let profileSyncDone = false;
    window.resetProfileSync = function() { profileSyncDone = false; };

    async function syncProfileFromAccount() {
        if (profileSyncDone) return;
        profileSyncDone = true;

        let remote = null;
        try {
            remote = await apiRequest('/auth/profile/about', 'GET');
        } catch (err) {
            console.warn('The account profile could not be read.', err);
        }
        if (!remote) return;

        const emailEl = profEl('profEmail');
        if (emailEl) emailEl.textContent = remote.email || '—';

        let filledSomething = false;
        Object.keys(PROFILE_FIELD_IDS).forEach(key => {
            const input = profEl(PROFILE_FIELD_IDS[key]);
            if (!input || input.value.trim() || !remote[key]) return;
            // Not while it is being typed in.
            if (document.activeElement === input) return;
            // Same trap as above: a value the list has never heard of would
            // blank the field instead of filling it.
            if (input.tagName === 'SELECT') keepUnlistedOption(input, remote[key]);
            input.value = remote[key];
            filledSomething = true;
        });

        // The account stores one display name, not two fields. Split it back
        // out so the surname does not vanish on a new device.
        const lastNameInput = profEl('profLastName');
        const firstNameInput = profEl('profFirstName');
        if (lastNameInput && !lastNameInput.value.trim() && remote.displayName) {
            const parts = remote.displayName.trim().split(/\s+/);
            const first = parts.shift() || '';
            if (firstNameInput && !firstNameInput.value.trim() && first) {
                firstNameInput.value = first;
                filledSomething = true;
            }
            if (parts.length) {
                lastNameInput.value = parts.join(' ');
                filledSomething = true;
            }
        }

        const form = profEl('profileForm');
        if (form && !form.dataset.avatar && remote.avatarDataUrl) {
            form.dataset.avatar = remote.avatarDataUrl;
            filledSomething = true;
        }

        const select = profEl('profPronouns');
        if (select && !select.value && remote.pronouns) {
            const norm = normalizePronouns(remote.pronouns);
            if (PRONOUN_PRESETS.indexOf(norm) !== -1) {
                select.value = norm;
            } else {
                select.value = '__custom';
                const custom = profEl('profPronounsCustom');
                const customField = profEl('profPronounsCustomField');
                if (custom) custom.value = remote.pronouns;
                if (customField) customField.hidden = false;
            }
            filledSomething = true;
        }

        if (!filledSomething) return;

        const merged = collectProfile();
        merged.email = remote.email || '';
        try {
            localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(merged));
        } catch (e) {
            /* Nothing to do but carry on showing it. */
        }
        renderProfileCard(merged);
        renderProfileDerived(merged);
        validateDob();
    }

    // ---- wiring, once ----

    (function wireProfile() {
        const form = profEl('profileForm');
        if (!form) return;

        // Never submits. It is a form so the browser groups and autofills the
        // fields properly; the Enter key must not throw the page away.
        form.addEventListener('submit', (e) => e.preventDefault());

        Object.keys(PROFILE_FLAGS).forEach(id => {
            const input = profEl(id);
            if (!input) return;
            input.addEventListener('change', () => requestProfileSave(input));
            if (input.tagName === 'INPUT' && (input.type === 'text' || input.type === 'tel')) {
                input.addEventListener('input', () => requestProfileSave(input));
            }
        });

        const bio = profEl('profBio');
        if (bio) {
            bio.addEventListener('input', () => {
                const count = profEl('profBioCount');
                if (count) count.textContent = String(bio.value.length);
                requestProfileSave(bio);
            });
        }

        const dob = profEl('profDob');
        if (dob) {
            dob.addEventListener('input', () => {
                validateDob();
                requestProfileSave(dob);
            });
        }

        const pronounSelect = profEl('profPronouns');
        if (pronounSelect) {
            pronounSelect.addEventListener('change', () => {
                const customField = profEl('profPronounsCustomField');
                const custom = profEl('profPronounsCustom');
                const isCustom = pronounSelect.value === '__custom';
                if (customField) customField.hidden = !isCustom;
                if (!isCustom && custom) custom.value = '';
                // Choosing "Something else" and being left to hunt for the box
                // that just appeared is a small cruelty. Go there.
                if (isCustom && custom) custom.focus();
                requestProfileSave(pronounSelect);
            });
        }

        const tzBtn = profEl('profTimeZoneDeviceBtn');
        if (tzBtn) {
            tzBtn.addEventListener('click', () => {
                const select = profEl('profTimeZone');
                const device = deviceTimeZone();
                if (!select || !device) return;
                // "Follow this device" is the blank option, which is the honest
                // answer: it keeps working when the person moves.
                select.value = '';
                requestProfileSave(select);
                if (typeof announce === 'function') announce(`Following this device: ${device}.`);
            });
        }

        const fileInput = profEl('profAvatarInput');
        if (fileInput) {
            fileInput.addEventListener('change', async () => {
                const file = fileInput.files && fileInput.files[0];
                if (!file) return;

                // Checked before decoding: a 60MB photo should be refused, not
                // loaded into memory first and refused afterwards.
                if (file.size > 12 * 1024 * 1024) {
                    showToast('That picture is over 12MB. Try a smaller one.', 'error');
                    fileInput.value = '';
                    return;
                }

                try {
                    const dataUrl = await resizeToAvatar(file);
                    form.dataset.avatar = dataUrl;
                    renderProfileCard(collectProfile());
                    const ok = await persistProfile();
                    if (ok) {
                        flashSaved(profEl('profSavedName'));
                        if (typeof announce === 'function') announce('Picture saved.');
                    }
                } catch (err) {
                    showToast(err.message || 'That picture could not be used.', 'error');
                } finally {
                    // Cleared so choosing the same file twice still counts as a
                    // change and still fires.
                    fileInput.value = '';
                    refreshIcons();
                }
            });
        }

        const removeBtn = profEl('profAvatarRemoveBtn');
        if (removeBtn) {
            removeBtn.addEventListener('click', async () => {
                form.dataset.avatar = '';
                renderProfileCard(collectProfile());
                const ok = await persistProfile();
                if (ok && typeof announce === 'function') announce('Picture removed.');
                // Focus would otherwise land nowhere: the button it was on has
                // just hidden itself.
                // A <label> cannot hold focus; the file input behind it can,
                // and it is what the label points at anyway.
                const pick = profEl('profAvatarInput');
                if (pick) pick.focus();
                refreshIcons();
            });
        }
    })();

    function openProfileView() {
        const navItem = document.querySelector('.nav-menu .nav-item[data-tab="profile"]');
        if (navItem) navItem.click();
    }

    const sidebarProfileBtn = profEl('sidebarProfileBtn');
    if (sidebarProfileBtn) sidebarProfileBtn.addEventListener('click', openProfileView);

    const dropdownProfileBtn = profEl('dropdownProfileBtn');
    if (dropdownProfileBtn) {
        dropdownProfileBtn.addEventListener('click', () => {
            const menu = document.getElementById('dropdownMenuBox');
            if (menu) menu.classList.remove('show');
            openProfileView();
        });
    }


    // 10. SPA URL Router & Tab Navigation Switcher
    const TAB_ROUTES = {
        'home': '/',
        'tasks': '/tasks',
        'analytics': '/patterns',
        'calendar': '/calendar',
        'profile': '/profile',
        'settings': '/settings'
    };
    const ROUTE_TO_TAB = {
        '/': 'home',
        '/today': 'home',
        '/home': 'home',
        '/tasks': 'tasks',
        '/everything': 'tasks',
        '/patterns': 'analytics',
        '/analytics': 'analytics',
        '/calendar': 'calendar',
        '/profile': 'profile',
        '/settings': 'settings'
    };

    function switchTab(tab, opts) {
        const options = opts || {};
        if (!tab || !TAB_ROUTES[tab]) tab = 'home';

        // Toggle active state on nav items
        document.querySelectorAll('.nav-menu .nav-item').forEach(i => {
            const isTarget = i.getAttribute('data-tab') === tab;
            i.classList.toggle('active', isTarget);
            if (isTarget) {
                i.setAttribute('aria-current', 'page');
            } else {
                i.removeAttribute('aria-current');
            }
        });

        const accountBox = document.getElementById('sidebarProfileBtn');
        if (accountBox) accountBox.classList.toggle('active', tab === 'profile');

        // Hide all tab views and show current
        document.querySelectorAll('.tab-view').forEach(view => view.classList.add('hidden'));
        let shownView = null;
        if (tab === 'home') {
            shownView = document.getElementById('homeView');
            if (shownView) shownView.classList.remove('hidden');
        } else if (tab === 'tasks') {
            shownView = document.getElementById('tasksView');
            if (shownView) shownView.classList.remove('hidden');
            renderAllTasksGrid();
        } else if (tab === 'analytics') {
            shownView = document.getElementById('analyticsView');
            if (shownView) shownView.classList.remove('hidden');
            setTimeout(() => {
                renderAnalyticsGraph();
            }, 50);
        } else if (tab === 'calendar') {
            shownView = document.getElementById('calendarFullView');
            if (shownView) shownView.classList.remove('hidden');
            initCalendar();
        } else if (tab === 'settings') {
            shownView = document.getElementById('settingsView');
            if (shownView) shownView.classList.remove('hidden');
            loadSettingsIntoForm();
        } else if (tab === 'profile') {
            shownView = document.getElementById('profileView');
            if (shownView) shownView.classList.remove('hidden');
            loadProfileIntoForm();
        }

        if (shownView) {
            shownView.style.animation = 'none';
            shownView.offsetHeight; /* trigger reflow */
            shownView.style.animation = '';
        }

        // Update URL via History API
        const targetUrl = TAB_ROUTES[tab] || '/';
        if (!options.fromPopState) {
            if (window.location.pathname !== targetUrl) {
                if (options.replace) {
                    history.replaceState({ tab: tab }, '', targetUrl);
                } else {
                    history.pushState({ tab: tab }, '', targetUrl);
                }
            }
        }

        if (!shownView) {
            shownView = document.querySelector('.tab-view:not(.hidden)');
        }
        if (options.focusHeading !== false && typeof focusFirstHeading === 'function') {
            focusFirstHeading(shownView);
        }
        if (typeof announce === 'function') {
            announce(tab + ' view.');
        }
    }
    window.switchTab = switchTab;

    document.querySelectorAll('.nav-menu .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tab = item.getAttribute('data-tab');
            if (tab) switchTab(tab);
        });
    });

    // Handle browser Back & Forward navigation
    window.addEventListener('popstate', (e) => {
        const stateTab = e.state && e.state.tab;
        const currentPath = window.location.pathname.toLowerCase();
        const tab = stateTab || ROUTE_TO_TAB[currentPath] || 'home';
        switchTab(tab, { fromPopState: true, focusHeading: false });
    });

    // Resolve initial route from URL upon page load
    (function initRoute() {
        const path = window.location.pathname.toLowerCase();
        const initialTab = ROUTE_TO_TAB[path] || (window.location.hash ? ROUTE_TO_TAB['/' + window.location.hash.replace(/^#\/?/, '')] : null);
        if (initialTab && initialTab !== 'home') {
            // Apply initial tab without adding duplicate history entry
            switchTab(initialTab, { replace: true, focusHeading: false });
        } else {
            // Ensure state exists for initial home route
            history.replaceState({ tab: 'home' }, '', window.location.pathname === '/' ? '/' : TAB_ROUTES['home']);
        }
    })();

    // 9. Set Current Date & Live Clock Display
    const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    const currentDateEl = document.getElementById('currentDate');
    if (currentDateEl) {
        currentDateEl.textContent = new Date().toLocaleDateString('en-GB', dateOptions);
    }

    let lastLiveMinute = -1;
    function updateLiveClock(m, force = false) {
        const mins = typeof m === 'number' ? m : nowMinutes();
        if (mins === lastLiveMinute && !force) return;
        lastLiveMinute = mins;
        const timeElBig = document.getElementById('currentTimeBig');
        if (timeElBig) timeElBig.textContent = formatAppTime(mins);
    }
    updateLiveClock();

    // The marks that say where in the day you are and the live clock move on the minute.
    let lastMinute = -1;
    setInterval(() => {
        const m = nowMinutes();
        updateLiveClock(m);
        if (m === lastMinute) return;
        lastMinute = m;
        renderNowBlock();
        renderTimelineNow();
    }, 5000);

    // 11. Settings View Loading, Theme and Saving Handler logic
    function loadSettingsIntoForm() {
        const nameInput = document.getElementById('settingsNameInput');
        const snoozeSelect = document.getElementById('settingsSnoozeSelect');
        const clockFormatSelect = document.getElementById('settingsClockFormat');
        const savedName = localStorage.getItem('bokea_username') || 'User';
        const savedSnooze = localStorage.getItem('bokea_default_snooze') || '24';
        const savedClockFormat = localStorage.getItem('bokea_clock_format') || '12h';
        const savedTheme = localStorage.getItem('bokea_theme') || 'light';

        if (nameInput) nameInput.value = savedName;
        if (snoozeSelect) snoozeSelect.value = savedSnooze;
        if (clockFormatSelect) {
            clockFormatSelect.value = savedClockFormat;
            if (clockFormatSelect.dataset.formatWired !== 'true') {
                clockFormatSelect.dataset.formatWired = 'true';
                clockFormatSelect.addEventListener('change', (e) => {
                    propagateClockFormatChange(e.target.value);
                });
            }
        }

        updateThemeCardSelection(savedTheme);

        // Load Schedule settings
        const settingsBedTime = document.getElementById('settingsBedTime');
        const settingsWakeUpTime = document.getElementById('settingsWakeUpTime');
        const settingsWorkStart = document.getElementById('settingsWorkStart');
        const settingsWorkEnd = document.getElementById('settingsWorkEnd');

        const savedBedTime = localStorage.getItem('bokea_bed_time') || '22:30';
        const savedWakeUpTime = localStorage.getItem('bokea_wakeup_time') || '06:30';
        const savedWorkStart = localStorage.getItem('bokea_work_start') || '09:00';
        const savedWorkEnd = localStorage.getItem('bokea_work_end') || '17:00';
        let savedWorkDays = [];
        try {
            savedWorkDays = JSON.parse(localStorage.getItem('bokea_work_days') || '["Monday","Tuesday","Wednesday","Thursday","Friday"]');
        } catch(e) {
            savedWorkDays = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
        }

        if (settingsBedTime) settingsBedTime.value = savedBedTime;
        if (settingsWakeUpTime) settingsWakeUpTime.value = savedWakeUpTime;
        if (settingsWorkStart) settingsWorkStart.value = savedWorkStart;
        if (settingsWorkEnd) settingsWorkEnd.value = savedWorkEnd;

        // Check the checkboxes for workdays
        document.querySelectorAll('input[name="settingsWorkDays"]').forEach(cb => {
            cb.checked = savedWorkDays.includes(cb.value);
        });

        // Setup settings page dynamic meter calculation
        if (settingsBedTime && settingsWakeUpTime) {
            const textEl = document.getElementById('settingsSleepDurationText');
            const labelEl = document.getElementById('settingsSleepHealthLabel');
            const barEl = document.getElementById('settingsSleepHealthBar');

            const triggerUpdate = () => {
                const duration = calculateSleepDuration(settingsBedTime.value, settingsWakeUpTime.value);
                if (textEl) textEl.textContent = `Sleep Duration: ${duration.toFixed(1)} hours`;
                if (labelEl && barEl) {
                    labelEl.className = 'health-badge';
                    barEl.className = 'meter-bar-fill';
                    if (duration >= 7 && duration <= 9) {
                        labelEl.textContent = 'Optimal';
                        labelEl.classList.add('health-optimal');
                        barEl.classList.add('health-optimal');
                        barEl.style.width = '100%';
                    } else if ((duration >= 6 && duration < 7) || (duration > 9 && duration <= 10)) {
                        labelEl.textContent = 'Marginal';
                        labelEl.classList.add('health-warning');
                        barEl.classList.add('health-warning');
                        barEl.style.width = '70%';
                    } else {
                        labelEl.textContent = 'Unhealthy';
                        labelEl.classList.add('health-danger');
                        barEl.classList.add('health-danger');
                        barEl.style.width = '40%';
                    }
                }
            };

            // Wire once. loadSettingsIntoForm runs every time the view is
            // opened, and re-adding these listeners each visit stacked up a
            // fresh copy per visit.
            if (settingsBedTime.dataset.meterWired !== 'true') {
                settingsBedTime.dataset.meterWired = 'true';
                settingsBedTime.addEventListener('input', triggerUpdate);
                settingsWakeUpTime.addEventListener('input', triggerUpdate);
            }
            triggerUpdate();
        }
    }

    // ---------- Nothing here waits on a Save button ----------
    //
    // The old screen held ten sections of changes and only wrote them when you
    // scrolled to the bottom and pressed Save. That is a working-memory tax and
    // a silent way to lose work. Every control now commits on change, and the
    // panel says so where you are already looking.

    // The timer hangs off the element rather than off one shared variable, so
    // acknowledging one panel never wipes the "Saved" still showing on another.
    const savedFlagTimers = new WeakMap();

    function flashSaved(el) {
        const flag = el || document.querySelector('.set-panel:not([hidden]) .set-saved');
        if (!flag) return;
        flag.textContent = 'Saved';
        flag.classList.add('is-on');
        clearTimeout(savedFlagTimers.get(flag));
        savedFlagTimers.set(flag, setTimeout(() => {
            flag.classList.remove('is-on');
            flag.textContent = '';
        }, 1800));
    }

    async function persistAppSettings() {
        const nameInput = document.getElementById('settingsNameInput');
        const snoozeSelect = document.getElementById('settingsSnoozeSelect');

        if (nameInput) {
            const name = nameInput.value.trim();
            if (name) {
                localStorage.setItem('bokea_username', name);
                updateGreetings(name);

                // Keep Profile view state in sync
                const profFirst = document.getElementById('profFirstName');
                if (profFirst && profFirst.value !== name) {
                    profFirst.value = name;
                }
                const currentProf = readLocalProfile();
                if (currentProf.firstName !== name) {
                    currentProf.firstName = name;
                    currentProf.displayName = [name, currentProf.lastName].filter(Boolean).join(' ');
                    try {
                        localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(currentProf));
                    } catch (e) {}
                    if (typeof renderProfileCard === 'function') renderProfileCard(currentProf);
                }
            }
        }

        if (snoozeSelect) {
            localStorage.setItem('bokea_default_snooze', snoozeSelect.value);
        }

        const darkCard = document.getElementById('themeDarkCard');
        const theme = (darkCard && darkCard.classList.contains('active')) ? 'dark' : 'light';
        setTheme(theme);

        // Save Schedule to API
        const token = localStorage.getItem('bokea_auth_token');
        const bedTime = document.getElementById('settingsBedTime').value;
        const wakeUpTime = document.getElementById('settingsWakeUpTime').value;
        const workStartTime = document.getElementById('settingsWorkStart').value;
        const workEndTime = document.getElementById('settingsWorkEnd').value;

        const workDays = [];
        document.querySelectorAll('input[name="settingsWorkDays"]:checked').forEach(cb => {
            workDays.push(cb.value);
        });

        localStorage.setItem('bokea_wakeup_time', wakeUpTime);
        localStorage.setItem('bokea_bed_time', bedTime);
        localStorage.setItem('bokea_work_start', workStartTime);
        localStorage.setItem('bokea_work_end', workEndTime);
        localStorage.setItem('bokea_work_days', JSON.stringify(workDays));
        invalidateDayShapeCache();

        const clockFormatSelect = document.getElementById('settingsClockFormat');
        if (clockFormatSelect) {
            localStorage.setItem('bokea_clock_format', clockFormatSelect.value);
        }

        propagateClockFormatChange();

        if (token) {
            try {
                await apiRequest('/auth/profile', 'PUT', {
                    wakeUpTime,
                    bedTime,
                    workStartTime,
                    workEndTime,
                    workDays
                });
            } catch (err) {
                console.error("Failed to save profile schedule settings to server.", err);
                showToast("Saved on this device, but not to your account.", "warning");
                return false;
            }
        }
        return true;
    }

    // A short debounce so typing a name is one write, not one per keystroke.
    let autosaveTimer = null;
    function requestSettingsSave(sourceEl) {
        const flag = sourceEl
            ? sourceEl.closest('.set-panel') && sourceEl.closest('.set-panel').querySelector('.set-saved')
            : null;
        clearTimeout(autosaveTimer);
        autosaveTimer = setTimeout(async () => {
            const ok = await persistAppSettings();
            if (ok) {
                flashSaved(flag);
                announce('Saved.');
            }
        }, 400);
    }

    function updateThemeCardSelection(theme) {
        const lightCard = document.getElementById('themeLightCard');
        const darkCard = document.getElementById('themeDarkCard');
        if (lightCard && darkCard) {
            const dark = theme === 'dark';
            lightCard.classList.toggle('active', !dark);
            darkCard.classList.toggle('active', dark);
            lightCard.setAttribute('aria-pressed', dark ? 'false' : 'true');
            darkCard.setAttribute('aria-pressed', dark ? 'true' : 'false');
        }
    }

    const appSettingsForm = document.getElementById('appSettingsForm');
    if (appSettingsForm) {
        // Enter in any field still commits everything at once, which is what a
        // keyboard user expects; it is simply no longer the only way to save.
        appSettingsForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            clearTimeout(autosaveTimer);
            if (await persistAppSettings()) {
                flashSaved();
                announce('Saved.');
            }
        });

        // Autosave. Text and time fields settle on 'change' (blur or a picker
        // commit); 'input' on the name field keeps the debounce honest while
        // someone is still typing.
        const autosaveIds = [
            'settingsNameInput', 'settingsSnoozeSelect', 'settingsClockFormat',
            'settingsBedTime', 'settingsWakeUpTime', 'settingsWorkStart', 'settingsWorkEnd'
        ];
        autosaveIds.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => requestSettingsSave(el));
            if (el.type === 'text') el.addEventListener('input', () => requestSettingsSave(el));
        });
        document.querySelectorAll('input[name="settingsWorkDays"]').forEach(cb => {
            cb.addEventListener('change', () => requestSettingsSave(cb));
        });
    }

    // ---------- The rail: one group on screen at a time ----------
    const setTabs = Array.from(document.querySelectorAll('.set-tab[data-sgroup]'));
    const SETTINGS_GROUP_KEY = 'bokea_settings_group';

    function showSettingsGroup(group, opts) {
        const focusIt = !!(opts && opts.focus);
        let matched = false;
        setTabs.forEach(tab => {
            const on = tab.getAttribute('data-sgroup') === group;
            if (on) matched = true;
            tab.setAttribute('aria-selected', on ? 'true' : 'false');
            tab.tabIndex = on ? 0 : -1;
            // On a narrow screen the rail is a horizontal strip; keep the
            // chosen group in view rather than off the edge of it.
            if (on && tab.scrollIntoView) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
        });
        if (!matched) return showSettingsGroup('you', opts);

        document.querySelectorAll('.set-panel[data-sgroup]').forEach(panel => {
            const isMatch = panel.getAttribute('data-sgroup') === group;
            panel.hidden = !isMatch;
            if (isMatch) {
                panel.style.animation = 'none';
                panel.offsetHeight; /* trigger reflow */
                panel.style.animation = '';
            }
        });

        try { localStorage.setItem(SETTINGS_GROUP_KEY, group); } catch (e) { /* storage blocked */ }

        if (focusIt) {
            const heading = document.querySelector('.set-panel:not([hidden]) .set-title');
            if (heading) heading.focus();
        }
        refreshIcons();
    }

    setTabs.forEach((tab, i) => {
        tab.addEventListener('click', () => {
            showSettingsGroup(tab.getAttribute('data-sgroup'), { focus: true });
        });
        // Arrow keys walk the rail, as a tablist should.
        tab.addEventListener('keydown', (e) => {
            let next = null;
            if (e.key === 'ArrowDown' || e.key === 'ArrowRight') next = setTabs[(i + 1) % setTabs.length];
            else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') next = setTabs[(i - 1 + setTabs.length) % setTabs.length];
            else if (e.key === 'Home') next = setTabs[0];
            else if (e.key === 'End') next = setTabs[setTabs.length - 1];
            if (!next) return;
            e.preventDefault();
            next.focus();
            showSettingsGroup(next.getAttribute('data-sgroup'));
        });
    });

    if (setTabs.length) {
        let startGroup = 'you';
        try { startGroup = localStorage.getItem(SETTINGS_GROUP_KEY) || 'you'; } catch (e) { /* storage blocked */ }
        showSettingsGroup(startGroup);
    }

    const lightCard = document.getElementById('themeLightCard');
    const darkCard = document.getElementById('themeDarkCard');
    if (lightCard && darkCard) {
        lightCard.addEventListener('click', () => {
            setTheme('light');
        });
        darkCard.addEventListener('click', () => {
            setTheme('dark');
        });
    }

    // Emptying the app is two deliberate taps in the page rather than one tap
    // and a browser dialog. An impulsive tap should not be able to finish this,
    // and a native confirm() is exactly the kind of prompt that gets dismissed
    // on reflex.
    const resetDataBtn = document.getElementById('settingsResetDataBtn');
    const resetConfirmBox = document.getElementById('settingsResetConfirm');
    const resetConfirmBtn = document.getElementById('settingsResetConfirmBtn');
    const resetCancelBtn = document.getElementById('settingsResetCancelBtn');

    function closeResetConfirm(focusBack) {
        if (!resetConfirmBox || !resetDataBtn) return;
        resetConfirmBox.hidden = true;
        resetDataBtn.hidden = false;
        resetDataBtn.setAttribute('aria-expanded', 'false');
        if (focusBack) resetDataBtn.focus();
    }

    if (resetDataBtn && resetConfirmBox) {
        resetDataBtn.addEventListener('click', () => {
            resetConfirmBox.hidden = false;
            resetDataBtn.setAttribute('aria-expanded', 'true');
            // The cancel button takes focus, not the destructive one.
            if (resetCancelBtn) resetCancelBtn.focus();
            announce('Confirm emptying the app, or keep your things.');
        });

        resetConfirmBox.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                closeResetConfirm(true);
            }
        });
    }

    if (resetCancelBtn) {
        resetCancelBtn.addEventListener('click', () => closeResetConfirm(true));
    }

    if (resetConfirmBtn) {
        resetConfirmBtn.addEventListener('click', () => {
            localStorage.removeItem(STORAGE_KEYS.TASKS);
            localStorage.removeItem(STORAGE_KEYS.HISTORY);
            initLocalStorage();
            closeResetConfirm(false);

            const homeNavItem = document.querySelector('.nav-menu .nav-item[data-tab="home"]');
            if (homeNavItem) homeNavItem.click();

            loadDashboardData();
            showToast("All data cleared. Your app is empty.", "warning");
        });
    }

});

// Expose click action handlers to the window object so dynamic templates can invoke them
window.completeTask = completeTask;
window.uncompleteTask = uncompleteTask;
window.snoozeTask = snoozeTask;
window.openSnoozeMenu = openSnoozeMenu;
window.deleteTask = deleteTask;
window.openEditTaskModal = openEditTaskModal;
window.openCreateTaskModal = openCreateTaskModal;
window.startFocus = startFocus;
window.scheduleParked = scheduleParked;

// Used by onboarding.js, which is loaded as a separate script.
window.showToast = showToast;
window.addSampleTasks = addSampleTasks;
window.loadDashboardData = loadDashboardData;
Object.defineProperty(window, 'supabaseClient', {
    get: function () { return supabaseClient; },
    configurable: true
});

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('ServiceWorker registration successful with scope: ', registration.scope);
      })
      .catch(err => {
        console.error('ServiceWorker registration failed: ', err);
      });
  });
}

// --- Push Notifications ---
// Converts the server's VAPID public key (base64url) into the Uint8Array format required by PushManager.subscribe.
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function getExistingPushSubscription() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null;
    const registration = await navigator.serviceWorker.ready;
    return registration.pushManager.getSubscription();
}

async function enablePushNotifications() {
    if (isFallbackMode) {
        showToast("Bokeà cannot reach the server right now, so notifications cannot be set up.", "warning");
        return;
    }
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        showToast("Push notifications aren't supported in this browser.", "error");
        return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
        showToast("Notification permission was not granted.", "warning");
        return;
    }

    try {
        const { publicKey } = await apiRequest('/push/vapid-public-key', 'GET');
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey)
        });

        const rawKeys = subscription.toJSON().keys;
        await apiRequest('/push/subscribe', 'POST', {
            endpoint: subscription.endpoint,
            keys: { p256dh: rawKeys.p256dh, auth: rawKeys.auth }
        });

        showToast("Push notifications enabled!");
        updatePushToggleUI(true);
    } catch (err) {
        console.error("Failed to enable push notifications", err);
        showToast("Couldn't enable push notifications.", "error");
    }
}

async function disablePushNotifications() {
    try {
        const subscription = await getExistingPushSubscription();
        if (subscription) {
            await apiRequest('/push/unsubscribe', 'POST', { endpoint: subscription.endpoint });
            await subscription.unsubscribe();
        }
        showToast("Push notifications disabled.");
    } catch (err) {
        console.error("Failed to disable push notifications", err);
    } finally {
        updatePushToggleUI(false);
    }
}

function updatePushToggleUI(isEnabled) {
    const label = document.getElementById('pushNotifToggleLabel');
    const status = document.getElementById('pushNotifStatus');
    const btn = document.getElementById('pushNotifToggleBtn');
    if (!label || !status || !btn) return;

    label.textContent = isEnabled ? 'Turn off reminders' : 'Turn on reminders';
    status.textContent = isEnabled
        ? 'Reminders are on for this device.'
        : 'Off. Your device will ask permission the first time.';
    btn.dataset.enabled = isEnabled ? 'true' : 'false';
}

async function initPushNotificationSettings() {
    const btn = document.getElementById('pushNotifToggleBtn');
    if (!btn || btn.dataset.wired === 'true') return;
    btn.dataset.wired = 'true';

    const subscription = await getExistingPushSubscription().catch(() => null);
    updatePushToggleUI(!!(subscription && typeof Notification !== 'undefined' && Notification.permission === 'granted'));

    btn.addEventListener('click', async () => {
        if (btn.dataset.enabled === 'true') {
            await disablePushNotifications();
        } else {
            await enablePushNotifications();
        }
    });
}

// --- Schedule Timeline Rendering Helper ---
function renderDailyScheduleTimeline() {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayName = weekdays[new Date().getDay()];

    const barContainer = document.getElementById('timelineBar');
    const legend = document.getElementById('timelineLegend');
    if (!barContainer || !legend) return;

    
    let workDays = [];
    try {
        workDays = JSON.parse(localStorage.getItem('bokea_work_days') || '["Monday","Tuesday","Wednesday","Thursday","Friday"]');
    } catch(e) {
        workDays = ["Monday","Tuesday","Wednesday","Thursday","Friday"];
    }

    const isWorkday = workDays.includes(todayName);

    // Same hours the rest of the app reads, from the same place, so this bar
    // and the blocks on every task cannot drift apart.
    const shape = dayShape();
    const wakeMin = shape.wake;
    const bedMin = shape.bed;
    const workStartMin = shape.workStart;
    const workEndMin = shape.workEnd;
    
    // Fill 1440 minutes (0 = Free, 1 = Sleep, 2 = Work)
    const minutes = new Array(1440).fill(0);
    
    // Fill Sleep
    if (bedMin > wakeMin) {
        for (let i = bedMin; i < 1440; i++) minutes[i] = 1;
        for (let i = 0; i < wakeMin; i++) minutes[i] = 1;
    } else {
        for (let i = bedMin; i < wakeMin; i++) minutes[i] = 1;
    }
    
    // Fill Work (overwrites Free, not Sleep)
    if (isWorkday) {
        if (workEndMin > workStartMin) {
            for (let i = workStartMin; i < workEndMin; i++) {
                if (minutes[i] === 0) minutes[i] = 2;
            }
        } else {
            for (let i = workStartMin; i < 1440; i++) {
                if (minutes[i] === 0) minutes[i] = 2;
            }
            for (let i = 0; i < workEndMin; i++) {
                if (minutes[i] === 0) minutes[i] = 2;
            }
        }
    }
    
    // Calculate Life Admin minutes from active tasks with intelligent placement
    const todayStr = new Date().toISOString().split('T')[0];

    tasks.forEach(t => {
        // Determine if task is active for today's timeline
        let isActiveToday = false;
        if (t.type === 'fixed') {
            isActiveToday = (t.dueDate === todayStr);
        } else {
            // Interval task: daily tasks (intervalDays === 1) or tasks currently in Red/Amber are active today
            const state = t.state || calculateTaskState(t);
            if (t.intervalDays === 1 || state === 'Red' || state === 'Amber') {
                isActiveToday = true;
            }
        }

        if (isActiveToday) {
            const dur = parseInt(t.durationMinutes) || 15;
            
            // 1. If task has a specific target time, place it directly around that time
            if (t.dueTime) {
                const targetMin = parseHM(t.dueTime, 0);
                let placed = 0;
                for (let i = targetMin; i < Math.min(1440, targetMin + dur); i++) {
                    if (minutes[i] !== 1) { // don't overwrite sleep
                        minutes[i] = 3;
                        placed++;
                    }
                }
                if (placed >= dur) return;
            }

            // 2. If preferred slot is morning, try placing between wakeMin and workStartMin
            if (t.timeSlot === 'morning' && wakeMin < workStartMin) {
                let placed = 0;
                for (let i = wakeMin; i < workStartMin; i++) {
                    if (placed >= dur) break;
                    if (minutes[i] === 0) {
                        minutes[i] = 3;
                        placed++;
                    }
                }
                if (placed >= dur) return;
            }

            // 3. If preferred slot is evening, try placing after workEndMin and before bedMin
            if (t.timeSlot === 'evening') {
                let placed = 0;
                const eveningStart = isWorkday ? workEndMin : 17 * 60;
                const eveningEnd = bedMin > wakeMin ? bedMin : 1440;
                for (let i = eveningStart; i < eveningEnd; i++) {
                    if (placed >= dur) break;
                    if (minutes[i] === 0) {
                        minutes[i] = 3;
                        placed++;
                    }
                }
                if (placed >= dur) return;
            }

            // 3b. Daytime had no branch of its own, so anything set to it was
            // scattered into the first free minute of the day - usually the
            // small hours. It gets its own window like the other two.
            if (t.timeSlot === 'afternoon') {
                const win = slotWindow('afternoon', shape);
                let placed = 0;
                for (let i = win.from; i < Math.min(1440, win.to); i++) {
                    if (placed >= dur) break;
                    if (minutes[i] === 0) {
                        minutes[i] = 3;
                        placed++;
                    }
                }
                if (placed >= dur) return;
            }

            // 4. Default: fill any available free time (minutes[i] === 0)
            let placed = 0;
            for (let i = 0; i < 1440; i++) {
                if (placed >= dur) break;
                if (minutes[i] === 0) {
                    minutes[i] = 3;
                    placed++;
                }
            }
        }
    });
    
    // Group minutes into blocks
    const segments = [];
    let currentState = minutes[0];
    let startMin = 0;
    
    for (let i = 1; i <= 1440; i++) {
        if (i === 1440 || minutes[i] !== currentState) {
            segments.push({
                state: currentState,
                start: startMin,
                end: i,
                duration: (i - startMin) / 60
            });
            if (i < 1440) {
                currentState = minutes[i];
                startMin = i;
            }
        }
    }

    // Map segments to HTML
    let barHtml = '';
    let sleepTotal = 0;
    let workTotal = 0;
    let freeTotal = 0;
    let lifeAdminTotal = 0;

    segments.forEach(seg => {
        let stateClass = 'segment-free';
        let stateName = 'Free Time';
        if (seg.state === 1) {
            stateClass = 'segment-sleep';
            stateName = 'Sleep';
            sleepTotal += seg.duration;
        } else if (seg.state === 2) {
            stateClass = 'segment-work';
            stateName = 'Work';
            workTotal += seg.duration;
        } else if (seg.state === 3) {
            stateClass = 'segment-life-admin';
            stateName = 'Life Admin';
            lifeAdminTotal += seg.duration;
        } else {
            freeTotal += seg.duration;
        }

        const widthPct = (seg.duration / 24) * 100;
        const timeTooltip = `${stateName}: ${fmtHM(seg.start)} - ${fmtHM(seg.end)} (${seg.duration.toFixed(1)} hrs)`;
        
        barHtml += `
            <div class="timeline-segment ${stateClass}" 
                 style="width: ${widthPct}%;" 
                 title="${timeTooltip}">
            </div>
        `;
    });
    
    barContainer.innerHTML = barHtml;

    renderTimelineNow();

    // Render legend
    const legendData = [
        { name: 'Sleep', hours: sleepTotal, color: 'var(--color-timeline-sleep)' },
        { name: 'Work', hours: workTotal, color: 'var(--color-timeline-work)' },
        { name: 'Life Admin', hours: lifeAdminTotal, color: 'var(--color-timeline-life-admin)' },
        { name: 'Free Time', hours: freeTotal, color: 'var(--color-timeline-free)' }
    ];

    let legendHtml = '';
    legendData.forEach(item => {
        const pct = (item.hours / 24) * 100;
        legendHtml += `
            <div style="display: flex; align-items: center; gap: 8px; justify-content: center; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--border-color); background: rgba(0,0,0,0.015);">
                <span style="width: 8px; height: 8px; border-radius: 50%; background: ${item.color}; border: 1px solid var(--border-color);"></span>
                <div style="display: flex; flex-direction: column; align-items: flex-start; gap: 1px;">
                    <span style="font-size: 0.72rem; font-weight: 600; color: var(--text-main);">${item.name}</span>
                    <span style="font-size: 0.65rem; color: var(--text-secondary);">${item.hours.toFixed(1)}h (${pct.toFixed(0)}%)</span>
                </div>
            </div>
        `;
    });
    legend.innerHTML = legendHtml;

    // Update timeline markers based on clock format
    const markersEl = document.getElementById('timelineMarkers');
    if (markersEl) {
        const format = localStorage.getItem('bokea_clock_format') || '12h';
        if (format === '12h') {
            markersEl.innerHTML = `
                <span>12 AM</span>
                <span>6 AM</span>
                <span>12 PM</span>
                <span>6 PM</span>
                <span>12 AM</span>
            `;
        } else {
            markersEl.innerHTML = `
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>00:00</span>
            `;
        }
    }

    // Update Day Badge
    const badge = document.getElementById('scheduleDayBadge');
    if (badge) {
        badge.textContent = 'Today';
    }
}

// Where you are on that bar. A picture of the whole day with no mark for the
// present moment is the exact shape of the problem this app is meant to help
// with, so the mark is drawn and labelled with the time it stands on. It is
// its own function because it moves every minute and the bar behind it does
// not: redrawing the whole schedule sixty times an hour to move one line
// would be silly.
function renderTimelineNow() {
    const bar = document.getElementById('timelineBar');
    const container = bar && bar.parentElement;
    if (!container) return;

    let marker = document.getElementById('timelineNow');
    if (!marker) {
        marker = document.createElement('div');
        marker.id = 'timelineNow';
        marker.className = 'timeline-now';
        marker.setAttribute('role', 'img');
        marker.innerHTML = '<span class="timeline-now-line"></span><span class="timeline-now-label"></span>';
        container.appendChild(marker);
    }

    const mins = nowMinutes();
    marker.style.left = `${(mins / 1440) * 100}%`;
    // The label would hang off the end of the bar late in the evening, so
    // after four in the afternoon it flips to the other side of the line.
    marker.classList.toggle('is-late', mins > 16 * 60);
    marker.querySelector('.timeline-now-label').textContent = fmtHM(mins);
    marker.setAttribute('aria-label', `Now, ${fmtHM(mins)}`);
}

// Expose renderDailyScheduleTimeline to the window object
window.renderDailyScheduleTimeline = renderDailyScheduleTimeline;

// ============================================================
// CALENDAR — one month, edge to edge.
//
// The month fills the section and each day says, in words, what
// is on it. There is no legend, because nothing is encoded: the
// names are written out and the 3px rail only repeats how
// pressing a thing is, which the words already said.
//
// Picking a day opens it over the top of everything, on a dim,
// with the same task rows used on Today and in Everything. One
// day, on its own, nothing else asking to be looked at. Escape,
// the backdrop and the close button all get you out, and focus
// goes back to the day you came from.
//
// Dates are handled in LOCAL time throughout. toISOString()
// is deliberately avoided here: west of UTC it silently reports
// yesterday, which put tasks on the wrong day.
// ============================================================

let calViewDate = new Date();               // which month is on screen
let calFocusStr = calDateStr(new Date());   // where the keyboard is
let calOpenStr = null;                      // which day the sheet is showing, if any
let calDayRelease = null;                   // releases the sheet's focus trap
let calWired = false;

// How many names fit in a cell before it stops being readable at a glance.
const CAL_CELL_MAX = 3;

// Local YYYY-MM-DD. Never toISOString().
function calDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calParse(dateStr) {
    const [y, m, d] = String(dateStr).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
}

const CAL_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];
const CAL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// A daily habit is true of every single day, so it says nothing about which
// day is heavy — writing it into all 30 cells would bury the things that
// actually land on a date. Dailies still appear in the day panel.
function calIsDaily(task) {
    return task.type === 'interval' && (parseInt(task.intervalDays) || 1) === 1;
}

// What actually lands on this specific day.
function calDatedTasksForDate(dateStr) {
    return getTasksForDate(dateStr)
        .filter(t => !calIsDaily(t))
        .map(t => Object.assign({}, t, { _calculatedState: t.state || calculateTaskState(t) }));
}

const CAL_RANK = { Red: 1, Amber: 2, Green: 3 };

function calStateCls(state) {
    return state === 'Red' ? 'red' : state === 'Amber' ? 'amber' : state ? 'green' : '';
}

function initCalendar() {
    if (!calWired) {
        const prev = document.getElementById('calPrevBtn');
        const next = document.getElementById('calNextBtn');
        const today = document.getElementById('calTodayBtn');
        const grid = document.getElementById('calGrid');
        const close = document.getElementById('calDayCloseBtn');
        const capture = document.getElementById('calDayCapture');

        if (prev) prev.addEventListener('click', () => calShiftMonth(-1));
        if (next) next.addEventListener('click', () => calShiftMonth(1));
        if (today) today.addEventListener('click', () => {
            const now = new Date();
            calViewDate = new Date(now.getFullYear(), now.getMonth(), 1);
            calFocusStr = calDateStr(now);
            renderCalendar();
        });

        // One delegated listener, so it survives every re-render of the grid.
        if (grid) {
            grid.addEventListener('click', (e) => {
                const cell = e.target.closest('.cal-cell');
                if (!cell) return;
                const dateStr = cell.getAttribute('data-date');
                // Clicking the open day again closes it: one control, both ways.
                calOpenStr = (calOpenStr === dateStr) ? null : dateStr;
                calFocusStr = dateStr;
                renderCalendar();
            });
            grid.addEventListener('keydown', calGridKeydown);
        }

        if (close) close.addEventListener('click', calCloseDay);

        // The dim is a way out too: clicking beside the day closes it.
        const overlay = document.getElementById('calDayOverlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) calCloseDay();
            });
            overlay.addEventListener('keydown', (e) => {
                if (e.key !== 'Escape') return;
                e.preventDefault();
                calCloseDay();
            });
        }

        if (capture) {
            capture.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (calOpenStr) commitCapture(capture, calOpenStr);
            });
        }

        calWired = true;
    }

    // The month always opens on today, with no day picked.
    const now = new Date();
    calViewDate = new Date(now.getFullYear(), now.getMonth(), 1);
    calFocusStr = calDateStr(now);
    calOpenStr = null;
    renderCalendar();
}

function calCloseDay() {
    if (!calOpenStr) return;
    calOpenStr = null;
    renderCalendar();
    // The grid was rebuilt, so the cell we came from is a new element:
    // put focus back on it by date rather than letting the trap restore
    // a node that no longer exists.
    const cell = document.querySelector(`.cal-cell[data-date="${calFocusStr}"]`);
    if (cell) cell.focus();
}

window.calCloseDay = calCloseDay;

function calShiftMonth(delta) {
    calViewDate = new Date(calViewDate.getFullYear(), calViewDate.getMonth() + delta, 1);
    // Keep the keyboard inside the month that is on screen.
    const f = calParse(calFocusStr);
    calFocusStr = calDateStr(new Date(calViewDate.getFullYear(), calViewDate.getMonth(),
        Math.min(f.getDate(), new Date(calViewDate.getFullYear(), calViewDate.getMonth() + 1, 0).getDate())));
    renderCalendar();
}

// Arrow keys walk the month; Enter and Space open the day the ordinary way.
function calGridKeydown(e) {
    if (e.key === 'Escape' && calOpenStr) {
        e.preventDefault();
        calCloseDay();
        return;
    }
    const steps = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const step = steps[e.key];
    if (!step) return;
    e.preventDefault();
    const d = calParse(calFocusStr);
    d.setDate(d.getDate() + step);
    calFocusStr = calDateStr(d);
    calViewDate = new Date(d.getFullYear(), d.getMonth(), 1);
    renderCalendar();
    const next = document.querySelector(`.cal-cell[data-date="${calFocusStr}"]`);
    if (next) next.focus();
}

function renderCalendar() {
    renderCalendarMonth();
    renderCalendarDay(calOpenStr);
    refreshIcons();
}

function renderCalendarMonth() {
    const grid = document.getElementById('calGrid');
    const titleEl = document.getElementById('calMonthTitle');
    if (!grid) return;

    const year = calViewDate.getFullYear();
    const month = calViewDate.getMonth();
    if (titleEl) titleEl.textContent = `${CAL_MONTHS[month]} ${year}`;

    // Monday-first grid.
    const first = new Date(year, month, 1);
    const lead = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells = Math.ceil((lead + daysInMonth) / 7) * 7;

    const todayStr = calDateStr(new Date());
    const calShape = dayShape();
    const html = [];
    let monthTotal = 0;
    let monthUrgent = 0;

    for (let i = 0; i < cells; i++) {
        const d = new Date(year, month, 1 - lead + i);
        const dateStr = calDateStr(d);
        const inMonth = d.getMonth() === month;
        // A day is read in the order it happens. Urgency is still on the rail
        // of every chip, so nothing is lost by putting the clock first.
        const list = calDatedTasksForDate(dateStr)
            .sort((a, b) => (taskWhen(a, calShape).sortKey - taskWhen(b, calShape).sortKey)
                || ((CAL_RANK[a._calculatedState] || 3) - (CAL_RANK[b._calculatedState] || 3)));
        const count = list.length;

        if (inMonth) {
            monthTotal += count;
            monthUrgent += list.filter(t => t._calculatedState === 'Red').length;
        }

        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const classes = ['cal-cell'];
        if (!inMonth) classes.push('is-outside');
        if (dateStr === todayStr) classes.push('is-today');
        if (dateStr === calOpenStr) classes.push('is-selected');
        if (isWeekend) classes.push('is-weekend');

        // The chips carry the names; the rail only repeats the urgency the
        // words already state, so nothing here depends on seeing colour.
        const shown = list.slice(0, CAL_CELL_MAX).map(t => {
            const w = taskWhen(t, calShape);
            return `
                    <span class="cal-chip${t._calculatedState === 'Red' ? ' is-urgent' : ''}">
                        <span class="cal-chip-rail ${calStateCls(t._calculatedState)}"></span>
                        ${w.exact ? `<span class="cal-chip-time">${esc(w.short)}</span>` : ''}
                        <span class="cal-chip-name">${esc(t.name)}</span>
                    </span>`;
        }).join('');
        const rest = count - Math.min(count, CAL_CELL_MAX);

        const said = (t) => {
            const w = taskWhen(t, calShape);
            return w.exact ? `${t.name} at ${w.short}` : `${t.name}, ${w.label.toLowerCase()}`;
        };
        const words = count === 0
            ? 'nothing due'
            : `${count} ${count === 1 ? 'thing' : 'things'}: ${list.map(said).join(', ')}`;

        html.push(`
            <button type="button" class="${classes.join(' ')}" data-date="${dateStr}"
                    tabindex="${dateStr === calFocusStr ? '0' : '-1'}"
                    aria-label="${esc(`${CAL_DAYS[d.getDay()]} ${d.getDate()} ${CAL_MONTHS[d.getMonth()]}, ${words}`)}"
                    aria-pressed="${dateStr === calOpenStr}">
                <span class="cal-cell-top">
                    <span class="cal-cell-num">${d.getDate()}</span>
                    ${dateStr === todayStr ? '<span class="cal-cell-tag">Today</span>' : ''}
                </span>
                <span class="cal-cell-items">${shown}</span>
                ${rest > 0 ? `<span class="cal-cell-more">+${rest} more</span>` : ''}
            </button>
        `);
    }

    grid.innerHTML = html.join('');

    // Rule 9: hand them a sentence, not a chart to interpret.
    const sentenceEl = document.getElementById('calMonthSentence');
    if (sentenceEl) {
        if (monthTotal === 0) {
            sentenceEl.textContent = 'Nothing booked in this month.';
        } else {
            const parts = [`${monthTotal} ${monthTotal === 1 ? 'thing' : 'things'} booked in`];
            if (monthUrgent) parts.push(`${monthUrgent} ${monthUrgent === 1 ? 'needs' : 'need'} you`);
            sentenceEl.textContent = parts.join(' · ');
        }
    }
}

// The sheet does not exist until a day is picked, so a null date is not
// an empty state to render — it is nothing at all.
function renderCalendarDay(dateStr) {
    const overlay = document.getElementById('calDayOverlay');
    const dialog = document.getElementById('calDayDialog');
    const listEl = document.getElementById('calDayList');
    const titleEl = document.getElementById('calDayTitle');
    const lineEl = document.getElementById('calDayLine');
    if (!overlay || !listEl) return;

    const wasOpen = overlay.classList.contains('open');

    if (!dateStr) {
        overlay.classList.remove('open');
        overlay.setAttribute('aria-hidden', 'true');
        if (calDayRelease) {
            calDayRelease(false);
            calDayRelease = null;
        }
        listEl.innerHTML = '';
        return;
    }

    overlay.classList.add('open');
    overlay.removeAttribute('aria-hidden');

    const d = calParse(dateStr);
    const todayStr = calDateStr(new Date());
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (titleEl) {
        const when = dateStr === todayStr ? 'Today'
            : dateStr === calDateStr(tomorrow) ? 'Tomorrow'
            : CAL_DAYS[d.getDay()];
        titleEl.textContent = `${when} · ${d.getDate()} ${CAL_MONTHS[d.getMonth()]}`;
    }

    const list = calDatedTasksForDate(dateStr);

    // A day runs forwards. Sorting it by urgency turned it into a ranked
    // list that happened to share a date; sorting it by the clock makes it
    // a day you can walk through from one end to the other.
    const shape = dayShape();
    const ordered = list
        .map(t => ({ t: t, w: taskWhen(t, shape) }))
        .sort((a, b) => (a.w.sortKey - b.w.sortKey)
            || ((CAL_RANK[a.t._calculatedState] || 3) - (CAL_RANK[b.t._calculatedState] || 3))
            || String(a.t.name || '').localeCompare(String(b.t.name || '')));

    // What is left, not what exists. A day with four things on it and three
    // of them ticked off is a day with one thing left, and saying "4 things"
    // at the top of it is the sort of number that makes people close the app.
    const left = ordered.filter(e => !taskDoneOn(e.t, dateStr));
    const doneCount = ordered.length - left.length;

    renderCalDayProgress(ordered.length, doneCount);

    if (lineEl) {
        if (ordered.length === 0) {
            lineEl.textContent = dateStr < todayStr ? 'Nothing was due.' : 'Nothing due. A clear day.';
        } else if (left.length === 0) {
            lineEl.textContent = 'All of it done. Nothing left on this day.';
        } else {
            const mins = left.reduce((sum, e) => sum + taskMinutes(e.t), 0);
            const first = left[0].w;
            const parts = [`${left.length} left`];
            // The first fixed point of the day is the useful number. A day of
            // nothing but "any time" has no first point, and says so.
            if (first.exact) parts.push(`starts ${first.short}`);
            else if (first.slot !== 'anytime') parts.push(`from the ${first.label.toLowerCase()}`);
            else parts.push('no set times');
            parts.push(`about ${mins} min in total`);
            lineEl.textContent = parts.join(' · ') + '.';
        }
    }

    if (ordered.length === 0) {
        listEl.innerHTML = `
            <div class="cal-day-empty">
                <i data-lucide="${dateStr < todayStr ? 'moon' : 'sun'}" aria-hidden="true"></i>
                <p class="cal-day-empty-head">${dateStr < todayStr ? 'Nothing was on this day.' : 'This day is clear.'}</p>
                <p class="cal-day-empty-sub">Add one thing below, or leave it exactly as it is.</p>
            </div>`;
        calOpenDayFocus(wasOpen, dialog);
        return;
    }

    // The blocks of the day are headings rather than a list of every hour: a
    // grid of 24 rows mostly holding nothing is exactly the kind of thing
    // this app is trying not to put in front of anybody.
    const isToday = dateStr === todayStr;
    const mins = nowMinutes();
    const html = [];
    let openSlot = null;
    let nowDrawn = !isToday;

    // How many things are in each block, so a heading is a size as well as a
    // name: "Daytime, 1 thing" is a block you can see the end of before you
    // have started reading it.
    const perSlot = {};
    ordered.forEach(({ w }) => { perSlot[w.slot] = (perSlot[w.slot] || 0) + 1; });

    // One row gets pointed at, and only ever one: the first thing on the day
    // still to be done. Choosing what to start is the expensive part, so the
    // day makes that choice on the way in and says so out loud. With a single
    // thing left there is no choice to make, and it stays quiet.
    const leadId = (dateStr >= todayStr && left.length > 1) ? left[0].t.id : null;

    ordered.forEach(({ t, w }) => {
        // The clock line goes above the heading of the block it lands in
        // front of, never below it: "Evening, 17:00-22:30" followed by
        // "Now, 16:42" is a day being read backwards.
        if (!nowDrawn && w.sortKey > mins) {
            html.push(calNowLine(mins));
            nowDrawn = true;
        }
        if (w.slot !== openSlot) {
            openSlot = w.slot;
            const meta = SLOT_META[openSlot];
            const win = slotWindow(openSlot, shape);
            const n = perSlot[openSlot] || 0;
            html.push(`
                <div class="cal-day-group">
                    <span class="cal-day-group-name"><i data-lucide="${meta.icon}"></i>${esc(meta.label)}</span>
                    <span class="cal-day-group-count">${n} ${n === 1 ? 'thing' : 'things'}</span>
                    <span class="cal-day-group-rule" aria-hidden="true"></span>
                    <span class="cal-day-group-range">${esc(openSlot === 'anytime' ? 'No set time' : `${fmtHM(win.from)}\u2013${fmtHM(win.to)}`)}</span>
                </div>
            `);
        }
        html.push(taskRowMarkup(t, dateStr, { lead: t.id === leadId }));
    });

    // Everything on the day is already behind you: the line goes at the end,
    // which is a true and quite useful thing to be shown.
    if (!nowDrawn) html.push(calNowLine(mins));

    listEl.innerHTML = html.join('');
    calOpenDayFocus(wasOpen, dialog);
}

// A day is easier to start when you can see it moving. The bar is the only
// place in the sheet that keeps score, it counts what is finished rather
// than what is outstanding, and it never appears on an empty day - a full
// bar over nothing at all is a reward for having had no day.
function renderCalDayProgress(total, done) {
    const wrap = document.getElementById('calDayProgress');
    const fill = document.getElementById('calDayProgressFill');
    const text = document.getElementById('calDayProgressText');
    if (!wrap || !fill || !text) return;

    if (!total) {
        wrap.hidden = true;
        return;
    }

    const pct = Math.round((done / total) * 100);
    wrap.hidden = false;
    wrap.classList.toggle('is-complete', done === total);
    wrap.setAttribute('aria-valuenow', String(done));
    wrap.setAttribute('aria-valuemax', String(total));
    wrap.setAttribute('aria-valuetext', `${done} of ${total} done`);
    fill.style.width = pct + '%';
    text.textContent = done === total
        ? `All ${total} done`
        : `${done} of ${total} done`;
}

// Where the clock is, drawn into the day itself. Not aria-hidden: "you are
// here" is the single most useful sentence on this panel, and a screen
// reader user has no other way to tell where in the list they have got to.
function calNowLine(mins) {
    return `
        <div class="cal-day-now" role="separator" aria-label="Now, ${esc(fmtHM(mins))}">
            <span class="cal-day-now-dot" aria-hidden="true"></span>
            <span class="cal-day-now-text" aria-hidden="true">Now · ${esc(fmtHM(mins))}</span>
            <span class="cal-day-now-rule" aria-hidden="true"></span>
        </div>
    `;
}

// Only on the way in: a re-render while the day is already open (a task
// ticked off, say) must not yank focus back to the top of the sheet.
function calOpenDayFocus(wasOpen, dialog) {
    if (wasOpen || !dialog) return;
    if (window.BokeaA11y) {
        calDayRelease = window.BokeaA11y.trapFocus(dialog, { initialFocus: '#calDayTitle' });
    } else {
        dialog.focus();
    }
    announce('Day opened. Press Escape to close.');
}

window.renderCalendar = renderCalendar;
window.renderCalendarDay = renderCalendarDay;

function getTasksForDate(dateStr) {
    const matching = [];
    if (!Array.isArray(tasks)) return matching;

    const cellDate = new Date(dateStr + 'T00:00:00');

    tasks.forEach(t => {
        const mapped = mapBackendTask(t);
        if (mapped.type === 'fixed') {
            if (mapped.dueDate === dateStr) {
                matching.push(mapped);
            }
        } else if (mapped.type === 'interval') {
            const interval = parseInt(mapped.intervalDays) || 1;
            if (interval === 1) {
                // Daily habit
                matching.push(mapped);
            } else {
                // Multi-day interval
                const anchorDate = mapped.lastCompleted ? new Date(mapped.lastCompleted) : new Date(mapped.createdAt || cellDate);
                const anchorMidnight = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), anchorDate.getDate());
                const diffDays = Math.round((cellDate.getTime() - anchorMidnight.getTime()) / 86400000);
                if (diffDays >= 0 && diffDays % interval === 0) {
                    matching.push(mapped);
                }
            }
        }
    });

    return matching;
}


// ============================================================
// BOKEÀ SYSTEM LAYER — shared helpers, preferences and wiring
// for the "Everything" idiom. Palette untouched; this is about
// how much the screen asks of you at once.
// ============================================================

var BOKEA_PREFS_KEY = 'bokea_ui_prefs';
var BOKEA_PREF_DEFAULTS = { capThree: true, gentle: true, streaks: false, motion: false, compact: false };
var uiPrefs = Object.assign({}, BOKEA_PREF_DEFAULTS);

function loadUiPrefs() {
    try {
        uiPrefs = Object.assign({}, BOKEA_PREF_DEFAULTS, JSON.parse(localStorage.getItem(BOKEA_PREFS_KEY) || '{}'));
    } catch (e) {
        uiPrefs = Object.assign({}, BOKEA_PREF_DEFAULTS);
    }
    applyUiPrefs();
}

function saveUiPrefs() {
    try { localStorage.setItem(BOKEA_PREFS_KEY, JSON.stringify(uiPrefs)); } catch (e) { /* storage full or blocked */ }
    applyUiPrefs();
}

function applyUiPrefs() {
    document.body.classList.toggle('density-compact', !!uiPrefs.compact);
    // Either switch turning motion off wins: the accessibility setting (which
    // also follows the operating system) or this app-level preference.
    const a11yReduced = window.BokeaA11y ? window.BokeaA11y.prefersReducedMotion() : false;
    document.body.classList.toggle('motion-off', !!uiPrefs.motion || a11yReduced);

    document.querySelectorAll('.sw[data-pref]').forEach(sw => {
        const on = !!uiPrefs[sw.getAttribute('data-pref')];
        sw.classList.toggle('on', on);
        sw.setAttribute('aria-checked', on ? 'true' : 'false');
        const word = sw.querySelector('.sw-word');
        if (word) word.textContent = on ? 'On' : 'Off';
    });

    // Rule 7: a broken streak is not information
    const streakCard = document.querySelector('.stat-card.streak');
    if (streakCard) streakCard.classList.toggle('hidden', !uiPrefs.streaks);
}

// ---------- Shared vocabulary ----------

function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
}

// Rule 8: colour never carries meaning alone — every state has an icon and a word
function stateMeta(state) {
    const s = String(state || 'Green').toLowerCase();
    if (s === 'parked') {
        return { key: 'parked', cls: 'state-parked', icon: 'inbox', word: 'Parked' };
    }
    if (s === 'red') {
        return { key: 'red', cls: 'state-red', icon: 'alert-circle', word: uiPrefs.gentle ? 'Needs you' : 'Overdue' };
    }
    if (s === 'amber') {
        return { key: 'amber', cls: 'state-amber', icon: 'clock', word: uiPrefs.gentle ? 'Due today' : 'Due soon' };
    }
    return { key: 'green', cls: 'state-green', icon: 'check', word: 'Safe' };
}

// Life areas are told apart by icon and word only — colour stays reserved for urgency
var AREA_META = {
    'Health & Vitality':      { icon: 'heart', short: 'Health' },
    'Career & Finance':       { icon: 'wallet', short: 'Money' },
    'Relationships & Social': { icon: 'users', short: 'People' },
    'Mind & Environment':     { icon: 'leaf', short: 'Mind' }
};

function areaMeta(category) {
    return AREA_META[category] || { icon: 'circle', short: category || 'Other' };
}

function taskMinutes(task) {
    const n = parseInt(task && task.durationMinutes);
    return (isFinite(n) && n > 0) ? n : 15;
}

// Rule 7: in gentle mode this never says how late something is
function cadenceText(task) {
    if (!task) return '';
    if (task.type === 'interval') {
        const n = parseInt(task.intervalDays) || 1;
        return n === 1 ? 'Every day' : `Every ${n} days`;
    }
    if (!task.dueDate) return 'No date';

    const due = new Date(String(task.dueDate).split('T')[0] + 'T00:00:00');
    if (isNaN(due.getTime())) return 'No date';
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = Math.round((due.getTime() - today.getTime()) / 86400000);

    if (days < 0) {
        if (uiPrefs.gentle) return 'Ready when you are';
        const n = Math.abs(days);
        return `${n} day${n === 1 ? '' : 's'} ago`;
    }
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `In ${days} days`;
}

function whyLine(task, meta, mins, when) {
    // Where in the day it sits comes first. That is the part that decides
    // whether it happens; the urgency is already stated on the pill beside it.
    const w = when || taskWhen(task);
    const at = w.exact
        ? `Set for ${w.short}. `
        : (w.slot === 'anytime' ? '' : `A ${w.label.toLowerCase()} thing. `);

    if (meta.key === 'red') {
        return at + (uiPrefs.gentle
            ? `This one has been waiting a while. About ${mins} minutes of your day.`
            : `Overdue. About ${mins} minutes.`);
    }
    if (meta.key === 'amber') return at + `Due today, and about ${mins} minutes.`;
    return at + `Nothing is pressing. This is simply next, about ${mins} minutes.`;
}

// ---------- Rule 2: time is always on screen ----------

function parseHM(value, fallback) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
    if (!m) return fallback;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
}

// Centralized time-formatting utility function for the entire application.
// Supports minute-of-day numbers (0..1440), Date instances, ISO strings,
// timestamp strings ("14:30"), and epoch millisecond timestamps.
function formatAppTime(value, options = {}) {
    if (value === null || value === undefined || value === '') return '';
    let totalMinutes;
    if (typeof value === 'number') {
        if (value >= 0 && value <= 1440 && !options.isTimestamp) {
            totalMinutes = Math.round(value);
        } else {
            const d = new Date(value);
            if (isNaN(d.getTime())) return '';
            totalMinutes = d.getHours() * 60 + d.getMinutes();
        }
    } else if (value instanceof Date) {
        if (isNaN(value.getTime())) return '';
        totalMinutes = value.getHours() * 60 + value.getMinutes();
    } else if (typeof value === 'string') {
        const str = value.trim();
        const timeMatch = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(str);
        if (timeMatch) {
            totalMinutes = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
        } else {
            const d = new Date(str);
            if (!isNaN(d.getTime())) {
                totalMinutes = d.getHours() * 60 + d.getMinutes();
            } else {
                const parsed = parseHM(str, null);
                if (parsed !== null) totalMinutes = parsed;
                else return String(value);
            }
        }
    } else {
        return String(value);
    }

    const total = ((Math.round(totalMinutes) % 1440) + 1440) % 1440;
    const h = Math.floor(total / 60);
    const m = total % 60;
    const mm = m < 10 ? '0' + m : String(m);
    const format = options.format || localStorage.getItem('bokea_clock_format') || '12h';

    if (format === '12h') {
        const ampm = h >= 12 ? 'pm' : 'am';
        const dh = h % 12 === 0 ? 12 : h % 12;
        return `${dh}:${mm}${ampm}`;
    }
    const hh = h < 10 ? '0' + h : String(h);
    return `${hh}:${mm}`;
}
window.formatAppTime = formatAppTime;

// Everything that prints a time routes through formatAppTime.
function fmtHM(mins) {
    return formatAppTime(mins);
}
window.fmtHM = fmtHM;

function syncTimeInputsClockFormat() {
    const is24 = (localStorage.getItem('bokea_clock_format') || '12h') === '24h';
    document.querySelectorAll('input[type="time"]').forEach(input => {
        if (is24) {
            input.setAttribute('lang', 'en-GB');
            input.setAttribute('step', '60');
        } else {
            input.removeAttribute('lang');
        }
    });
}
window.syncTimeInputsClockFormat = syncTimeInputsClockFormat;

// Propagates 12h/24h clock format changes across all time-of-day badges, clocks,
// schedule cards, and timestamp labels across the interface without a page reload.
function propagateClockFormatChange(newFormat) {
    if (newFormat) {
        try { localStorage.setItem('bokea_clock_format', newFormat); } catch(e) {}
    }
    syncTimeInputsClockFormat();
    updateLiveClock(nowMinutes(), true);
    renderDailyScheduleTimeline();
    renderNowBlock();
    renderTimelineNow();
    renderNextUpTask();
    renderAllTasksGrid();
    renderCalendar();
    syncWhenUI();
    try {
        window.dispatchEvent(new CustomEvent('bokea-clock-format-changed', {
            detail: { format: localStorage.getItem('bokea_clock_format') || '12h' }
        }));
    } catch(e) {}
}
window.propagateClockFormatChange = propagateClockFormatChange;

// ---------- When in the day ----------
//
// A date says which day a thing lands on. It says nothing about when in that
// day, which is the part that actually decides whether it happens. Every
// screen that shows a task asks taskWhen() the same question and gets the
// same answer, so the time in the calendar, on the home card and in a list
// is one fact worked out once rather than three that drift apart.
//
// The blocks are not fixed hours. Morning means "between when you get up and
// when work starts", read from the times given in Settings, so somebody who
// starts at six is not told their seven o'clock run is a morning thing when
// for them it is already the middle of the working day.

// In-memory cache for day shape to prevent repetitive synchronous localStorage reads in loops
let cachedDayShape = null;
function invalidateDayShapeCache() {
    cachedDayShape = null;
}

function dayShape() {
    if (!cachedDayShape) {
        cachedDayShape = {
            wake: parseHM(localStorage.getItem('bokea_wakeup_time'), 6 * 60 + 30),
            workStart: parseHM(localStorage.getItem('bokea_work_start'), 9 * 60),
            workEnd: parseHM(localStorage.getItem('bokea_work_end'), 17 * 60),
            bed: parseHM(localStorage.getItem('bokea_bed_time'), 22 * 60 + 30)
        };
    }
    return cachedDayShape;
}

// Rule 8 again: each block is told apart by an icon and a word, never a colour.
var SLOT_META = {
    morning:   { label: 'Morning', icon: 'sunrise' },
    afternoon: { label: 'Daytime', icon: 'sun' },
    evening:   { label: 'Evening', icon: 'sunset' },
    anytime:   { label: 'Any time', icon: 'circle-dashed' }
};

var SLOT_ORDER = ['morning', 'afternoon', 'evening', 'anytime'];

// Hours that read backwards (a night shift, a half-filled settings form)
// would give a window with no width, so a window is never allowed to end
// before it starts.
function slotWindow(slot, shape) {
    const s = shape || dayShape();
    const span = (from, to) => ({ from: from, to: to > from ? to : from + 60 });
    if (slot === 'morning') return span(s.wake, s.workStart);
    if (slot === 'afternoon') return span(s.workStart, s.workEnd);
    if (slot === 'evening') return span(s.workEnd, s.bed);
    return span(s.wake, s.bed);
}

// Which block a clock time falls in, for this person's hours.
function slotForMinutes(mins, shape) {
    const s = shape || dayShape();
    if (mins < s.workStart) return 'morning';
    if (mins < s.workEnd) return 'afternoon';
    return 'evening';
}

function nowMinutes() {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
}

// The one answer to "when does this happen?".
function taskWhen(task, shape) {
    const s = shape || dayShape();
    const raw = String((task && task.dueTime) || '');
    const exactMins = /^\d{1,2}:\d{2}$/.test(raw) ? parseHM(raw, null) : null;

    if (exactMins !== null) {
        const mins = taskMinutes(task);
        return {
            exact: true,
            slot: slotForMinutes(exactMins, s),
            icon: 'clock',
            from: exactMins,
            to: exactMins + mins,
            sortKey: exactMins,
            short: fmtHM(exactMins),
            label: `At ${fmtHM(exactMins)}`,
            range: `${fmtHM(exactMins)} to ${fmtHM(exactMins + mins)}`
        };
    }

    const asked = String((task && task.timeSlot) || 'anytime');
    const slot = SLOT_META[asked] ? asked : 'anytime';
    const win = slotWindow(slot, s);
    const meta = SLOT_META[slot];
    return {
        exact: false,
        slot: slot,
        icon: meta.icon,
        from: win.from,
        to: win.to,
        // Half a minute short of the end of its block. Things with a clock
        // time are the fixed points of a day and a loose "sometime this
        // morning" fits around them, so within a block the exact times come
        // first and the block itself trails them - but still ahead of the
        // next block. "Any time" is not a time at all, so it sorts past the
        // end of the day entirely.
        sortKey: slot === 'anytime' ? 24 * 60 + 1 : win.to - 0.5,
        short: meta.label,
        label: meta.label,
        range: slot === 'anytime' ? 'Whenever it suits' : `${fmtHM(win.from)} to ${fmtHM(win.to)}`
    };
}

// Which day a row is being read on. Usually the day the caller is drawing,
// and otherwise the task's own date, so a row on the home screen answers
// "is that now?" against the day it actually belongs to.
function taskRowDate(task, dateStr) {
    if (dateStr) return dateStr;
    if (task && task.type === 'fixed') return String(task.dueDate || '').split('T')[0];
    return calDateStr(new Date());
}

// Has the window closed already? Only ever true for today: a clock time on
// a day that has not arrived has not been missed, it just has not happened.
function whenIsPast(task, dateStr, shape) {
    const w = taskWhen(task, shape);
    if (!w.exact) return false;
    if (taskRowDate(task, dateStr) !== calDateStr(new Date())) return false;
    return nowMinutes() > w.to;
}

// What the chip on a row actually says. A time that has already gone past is
// said in words - "was 9:00am" - and not coloured, because red already means
// something else here and a missed clock time is not the same as overdue.
function whenChipText(task, dateStr, shape) {
    const w = taskWhen(task, shape);
    if (!w.exact) return w.short;
    return whenIsPast(task, dateStr, shape) ? `Was ${w.short}` : w.short;
}

// Is the clock inside this thing's window right now? Only ever true for today.
function whenIsNow(task, dateStr, shape) {
    const w = taskWhen(task, shape);
    if (w.slot === 'anytime') return false;
    if (taskRowDate(task, dateStr) !== calDateStr(new Date())) return false;

    const mins = nowMinutes();
    return mins >= w.from && mins < w.to;
}

// Was this ticked off on the day being shown? A daily habit appears on every
// date, so "done" belongs to the day you are looking at rather than to the
// task, and only the day it was actually completed on gets to say so.
function taskDoneOn(task, dateStr) {
    if (!task || !task.lastCompleted) return false;
    const d = new Date(task.lastCompleted);
    if (isNaN(d.getTime())) return false;
    return calDateStr(d) === (dateStr || calDateStr(new Date()));
}

function renderNowBlock() {
    const nameEl = document.getElementById('nowBlockName');
    const leftEl = document.getElementById('nowBlockLeft');
    const fillEl = document.getElementById('nowBlockFill');
    const startEl = document.getElementById('nowBlockStart');
    const endEl = document.getElementById('nowBlockEnd');
    if (!nameEl || !fillEl) return;

    const { wake, workStart, workEnd, bed } = dayShape();
    const mins = nowMinutes();

    // The same three names the blocks use on every task, so the bar in the
    // corner and the word on a row are talking about the same thing. Night
    // and wind-down are not blocks anything can be scheduled into, so they
    // keep their own names.
    let label, from, to;
    if (mins < wake) { label = 'Still night'; from = bed > mins ? 0 : bed; to = wake; }
    else if (mins < workStart) { label = SLOT_META.morning.label; from = wake; to = workStart; }
    else if (mins < workEnd) { label = SLOT_META.afternoon.label; from = workStart; to = workEnd; }
    else if (mins < bed) { label = SLOT_META.evening.label; from = workEnd; to = bed; }
    else { label = 'Wind-down'; from = bed; to = 24 * 60; }

    const span = Math.max(1, to - from);
    const pct = Math.max(0, Math.min(100, ((mins - from) / span) * 100));
    const remaining = Math.max(0, to - mins);
    const h = Math.floor(remaining / 60);
    const m = remaining % 60;

    nameEl.textContent = label;
    if (leftEl) leftEl.textContent = remaining <= 0 ? 'done' : (h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    fillEl.style.width = pct.toFixed(1) + '%';
    if (startEl) startEl.textContent = fmtHM(from) + ' start';
    if (endEl) endEl.textContent = fmtHM(to) + ' end';
}

// ---------- Rule 9: the chart hands you a sentence ----------

function renderAnalyticsFinding() {
    const el = document.getElementById('analyticsFinding');
    if (!el) return;

    const logs = Array.isArray(historyData) ? historyData.filter(h => h && h.date) : [];
    if (logs.length < 5) {
        el.textContent = 'Not enough history yet — a few more days and this will tell you which days actually carry you.';
        return;
    }

    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const sum = {}, count = {};
    logs.forEach(h => {
        const d = new Date(h.date);
        if (isNaN(d.getTime())) return;
        const k = d.getDay();
        sum[k] = (sum[k] || 0) + (Number(h.rate) || 0);
        count[k] = (count[k] || 0) + 1;
    });

    const avgs = Object.keys(count).map(k => ({ day: Number(k), avg: sum[k] / count[k] }));
    if (avgs.length < 2) {
        el.textContent = 'Still building a picture of your week.';
        return;
    }
    avgs.sort((a, b) => b.avg - a.avg);
    const best = avgs[0];
    const worst = avgs[avgs.length - 1];

    el.textContent = `${names[best.day]}s carry you — around ${Math.round(best.avg)}% of what is due gets done. ${names[worst.day]}s are your thinnest at ${Math.round(worst.avg)}%. Worth putting less on a ${names[worst.day]}.`;
}

// ---------- Rule 5: capture never costs a modal ----------

// "Gym 7pm" is how people actually write things down, and asking them to open
// a modal to say the 7pm part is how the time gets lost. A time is only taken
// off the end when it is unmistakably one - it needs either a meridiem or
// minutes after a separator - so "Read 15 pages" and "Drink 2L water" survive
// intact. Whatever is taken is said back in the toast: this never happens
// silently.
function captureTime(text) {
    const m = /^(.*?)[\s,]+(?:at\s+|@\s*)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?$/i.exec(text);
    if (!m) return null;

    const name = m[1].trim();
    const mins = m[3] === undefined ? null : parseInt(m[3], 10);
    const meridiem = m[4] ? m[4].toLowerCase() : null;
    if (!name) return null;
    if (mins === null && !meridiem) return null;

    let hour = parseInt(m[2], 10);
    if (meridiem) {
        if (hour < 1 || hour > 12) return null;
        if (meridiem === 'pm' && hour !== 12) hour += 12;
        if (meridiem === 'am' && hour === 12) hour = 0;
    } else if (hour > 23) {
        return null;
    }
    if (mins !== null && mins > 59) return null;

    const total = hour * 60 + (mins || 0);
    return { name: name, dueTime: `${hour < 10 ? '0' : ''}${hour}:${mins === null ? '00' : String(mins).padStart(2, '0')}`, minutes: total };
}

async function commitCapture(input, dueDateStr) {
    const raw = (input.value || '').trim();
    if (!raw) return;

    const parsed = captureTime(raw);
    const name = parsed ? parsed.name : raw;

    // A thought is not a commitment. Dating it "today" on the way in is what
    // turned this box - the best thing in the app - into a machine for
    // manufacturing red: parked at four, amber by dinner, late by morning.
    //
    // So an untimed capture gets no date at all and sits in the parked tray
    // until somebody gives it one. A capture that names a time ("call mum at
    // 7pm") genuinely is scheduled, and keeps today's date as before. A
    // capture typed into a specific day on the calendar keeps that day.
    const payload = {
        name: name,
        category: 'Mind & Environment',
        type: 'fixed',
        dueDate: dueDateStr || (parsed ? calDateStr(new Date()) : null),
        dueTime: parsed ? parsed.dueTime : null,
        timeSlot: parsed ? slotForMinutes(parsed.minutes) : 'anytime',
        durationMinutes: 15,
        notifyPref: 'digest'
    };

    input.value = '';
    try {
        await apiRequest('/tasks', 'POST', payload);
        showToast(parsed
            ? `Set for ${fmtHM(parsed.minutes)}.`
            : (dueDateStr ? 'Added to that day.' : 'Parked. No date, no nagging.'));
        await loadDashboardData();
    } catch (err) {
        console.error('Error parking task:', err);
        showToast('Could not save that', 'error');
        // What they typed, not what was parsed out of it: a failed save must
        // hand back exactly the sentence they wrote.
        input.value = raw;
    }
}

// ============================================================
// FIRST RUN
// ------------------------------------------------------------
// The way in used to be: auth, then a schedule form asking for four
// times and a weekday pattern, then a nine-step modal tour explaining
// an empty app. Eleven screens before anybody could do anything, and
// both of the questions asked before there was any way to know what
// the answers were for.
//
// Now the app itself is the first screen. This card sits at the top of
// an empty Today with one field already on the page below it, and the
// examples are offered here rather than at the end of a tour almost
// nobody reached.
// ============================================================

function firstRunDismissed() {
    try { return localStorage.getItem(`bokea_firstrun_done_${storageScope}`) === 'true'; }
    catch (e) { return false; }
}

function dismissFirstRun() {
    try { localStorage.setItem(`bokea_firstrun_done_${storageScope}`, 'true'); } catch (e) { /* blocked */ }
    renderFirstRun();
}

function renderFirstRun() {
    const card = document.getElementById('firstRunCard');
    if (!card) return;

    const empty = !Array.isArray(tasks) || tasks.length === 0;
    const show = empty && !firstRunDismissed();
    card.classList.toggle('hidden', !show);
    if (!show) return;

    card.innerHTML = `
        <h2 class="first-run-title">Nothing in here yet.</h2>
        <p class="first-run-body">
            Type the thing you keep forgetting into the box at the bottom of this
            screen and press Enter. It gets saved with no date and no nagging until
            you give it one.
        </p>
        <div class="first-run-actions">
            <button type="button" class="btn btn-secondary" id="firstRunSamplesBtn">
                <i data-lucide="sparkles" aria-hidden="true"></i><span>Start with three examples</span>
            </button>
            <button type="button" class="btn btn-secondary" id="firstRunDismissBtn">
                <span>I'll start on my own</span>
            </button>
        </div>
    `;

    const samples = document.getElementById('firstRunSamplesBtn');
    if (samples) samples.addEventListener('click', async () => {
        dismissFirstRun();
        await addSampleTasks();
    });
    const dismiss = document.getElementById('firstRunDismissBtn');
    if (dismiss) {
        dismiss.addEventListener('click', () => {
            dismissFirstRun();
            const capture = document.getElementById('captureInput');
            if (capture) capture.focus();
        });
    }
    refreshIcons();
}

// The schedule is asked for at the first moment it actually decides
// something - the first time a task is filed into a part of the day - and
// never before. Asked once; Settings owns it after that.
function maybeAskForSchedule(timeSlot) {
    if (!timeSlot || timeSlot === 'anytime') return;
    if (localStorage.getItem('bokea_setup_completed') === 'true') return;
    if (localStorage.getItem('bokea_schedule_asked') === 'true') return;

    try { localStorage.setItem('bokea_schedule_asked', 'true'); } catch (e) { /* blocked */ }

    const setupScreen = document.getElementById('setupScreen');
    if (!setupScreen) return;

    const heading = document.getElementById('setupHeading');
    if (heading) heading.textContent = 'When does your day run?';
    const progress = setupScreen.querySelector('.onboarding-progress');
    if (progress) {
        progress.textContent = 'You just filed something into a part of the day \u2014 here is what those mean';
    }

    setupScreen.classList.remove('hidden');
    setupScreen.removeAttribute('aria-hidden');
    focusFirstHeading(setupScreen);
}

// ============================================================
// FOCUS
// ------------------------------------------------------------
// The app already knew how long everything takes - "Done - 2 min" was the
// primary button on the hero card - and offered no way to run those two
// minutes. Knowing what to do is rarely the bottleneck. Starting is.
//
// So: one task, its own duration counting down, and nothing else on screen.
// The thought that arrives thirty seconds in goes into the box at the bottom
// and stays out of the way, because leaving the task to write it down is how
// the task ends. Designed in design/Focus.dc.html; this is that screen.
// ============================================================

var focusState = { id: null, endsAt: 0, remaining: 0, running: false, tick: null, returnTo: null };

function startFocus(id) {
    const task = (Array.isArray(tasks) ? tasks : []).find(t => String(t.id) === String(id));
    if (!task) return;

    const overlay = document.getElementById('focusOverlay');
    if (!overlay) return;

    focusState.returnTo = document.activeElement;
    focusState.id = task.id;
    focusState.remaining = taskMinutes(task) * 60;
    focusState.endsAt = Date.now() + focusState.remaining * 1000;
    focusState.running = true;

    const nameEl = document.getElementById('focusTaskName');
    const whyEl = document.getElementById('focusTaskWhy');
    if (nameEl) nameEl.textContent = task.name || '';
    if (whyEl) whyEl.textContent = task.description || cadenceText(task) || '';

    const parked = document.getElementById('focusParkedList');
    if (parked) parked.innerHTML = '';

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('focus-open');

    renderFocusClock();
    clearInterval(focusState.tick);
    focusState.tick = setInterval(renderFocusClock, 250);

    updateFocusPauseButton();
    const done = document.getElementById('focusDoneBtn');
    if (done) done.focus();
    announce(`Focusing on ${task.name}. ${taskMinutes(task)} minutes.`);
}

function renderFocusClock() {
    const el = document.getElementById('focusTimer');
    const ring = document.getElementById('focusRingFill');
    const phase = document.getElementById('focusPhase');
    if (!el) return;

    if (focusState.running) {
        focusState.remaining = Math.max(0, Math.round((focusState.endsAt - Date.now()) / 1000));
    }

    const total = Math.max(1, focusState.remaining);
    const m = Math.floor(focusState.remaining / 60);
    const sec = focusState.remaining % 60;
    el.textContent = `${m}:${String(sec).padStart(2, '0')}`;

    const task = (Array.isArray(tasks) ? tasks : []).find(t => String(t.id) === String(focusState.id));
    const planned = task ? taskMinutes(task) * 60 : total;
    if (ring) {
        const pct = Math.max(0, Math.min(1, focusState.remaining / planned));
        ring.style.width = `${Math.round(pct * 100)}%`;
    }

    if (focusState.remaining === 0 && focusState.running) {
        focusState.running = false;
        clearInterval(focusState.tick);
        focusState.tick = null;
        if (phase) phase.textContent = 'Time is up. Stop, or keep going - both are fine.';
        updateFocusPauseButton();
        announce('Time is up.');
    } else if (phase && focusState.running) {
        phase.textContent = 'Running. Nothing else needs you right now.';
    }
}

function toggleFocusPause() {
    if (!focusState.id) return;
    if (focusState.running) {
        focusState.running = false;
        clearInterval(focusState.tick);
        focusState.tick = null;
    } else {
        focusState.endsAt = Date.now() + focusState.remaining * 1000;
        focusState.running = true;
        clearInterval(focusState.tick);
        focusState.tick = setInterval(renderFocusClock, 250);
    }
    updateFocusPauseButton();
    renderFocusClock();
}

function updateFocusPauseButton() {
    const btn = document.getElementById('focusPauseBtn');
    const phase = document.getElementById('focusPhase');
    if (!btn) return;
    const label = btn.querySelector('span');
    if (label) label.textContent = focusState.running ? 'Pause' : 'Resume';
    const icon = btn.querySelector('i');
    if (icon) { icon.setAttribute('data-lucide', focusState.running ? 'pause' : 'play'); refreshIcons(); }
    if (phase && !focusState.running && focusState.remaining > 0) {
        phase.textContent = 'Paused. The clock waits for you.';
    }
}

function closeFocus() {
    const overlay = document.getElementById('focusOverlay');
    clearInterval(focusState.tick);
    focusState.tick = null;
    focusState.running = false;
    focusState.id = null;
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('focus-open');
    const back = focusState.returnTo;
    if (back && document.contains(back)) back.focus();
}

async function finishFocus() {
    const id = focusState.id;
    closeFocus();
    if (id) await completeTask(id);
}

// Park the whole task: this was the wrong thing to be doing, and saying so
// should cost one tap and carry no penalty.
function parkWholeFocusTask() {
    const id = focusState.id;
    closeFocus();
    if (id) snoozeTask(id, 5);
}

// The intrusive thought goes in here and the task carries on. It lands in
// the parked tray - the inbox, not away - exactly like the capture bar.
async function parkFocusThought() {
    const input = document.getElementById('focusParkInput');
    if (!input) return;
    const raw = (input.value || '').trim();
    if (!raw) return;
    input.value = '';

    const list = document.getElementById('focusParkedList');
    if (list) {
        const row = document.createElement('div');
        row.className = 'focus-parked-row';
        row.textContent = raw;
        list.appendChild(row);
    }

    try {
        await apiRequest('/tasks', 'POST', {
            name: raw,
            category: 'Mind & Environment',
            type: 'fixed',
            dueDate: null,
            timeSlot: 'anytime',
            durationMinutes: 15,
            notifyPref: 'digest'
        });
        announce('Parked.');
    } catch (err) {
        console.error('Could not park that thought:', err);
        showToast('Could not park that.', 'error');
    }
}

function wireFocus() {
    const done = document.getElementById('focusDoneBtn');
    const pause = document.getElementById('focusPauseBtn');
    const park = document.getElementById('focusParkTaskBtn');
    const close = document.getElementById('focusCloseBtn');
    const input = document.getElementById('focusParkInput');

    if (done) done.addEventListener('click', finishFocus);
    if (pause) pause.addEventListener('click', toggleFocusPause);
    if (park) park.addEventListener('click', parkWholeFocusTask);
    if (close) close.addEventListener('click', closeFocus);
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); parkFocusThought(); }
        });
    }

    // Escape leaves without judgement, and without completing anything.
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && focusState.id) { e.preventDefault(); closeFocus(); }
    });
}

// ---------- Wiring ----------

document.addEventListener('DOMContentLoaded', () => {
    loadUiPrefs();

    // Preference switches
    document.querySelectorAll('.sw[data-pref]').forEach(sw => {
        sw.addEventListener('click', () => {
            const key = sw.getAttribute('data-pref');
            uiPrefs[key] = !uiPrefs[key];
            saveUiPrefs();
            tasksUncapped = false;
            renderAllTasksGrid();
            renderNextUpTask();
        });
    });

    // Waiting-on-you fold
    const foldHead = document.getElementById('waitingFoldHead');
    const foldBody = document.getElementById('waitingFoldBody');
    const foldLabel = document.getElementById('waitingFoldLabel');
    const foldIcon = document.getElementById('waitingFoldIcon');
    if (foldHead && foldBody) {
        foldHead.addEventListener('click', () => {
            const nowHidden = foldBody.classList.toggle('hidden');
            const count = foldBody.querySelectorAll('.task-row').length;
            foldHead.setAttribute('aria-expanded', nowHidden ? 'false' : 'true');
            if (foldLabel) foldLabel.textContent = nowHidden ? `Show ${count}` : 'Hide';
            if (foldIcon) {
                foldIcon.setAttribute('data-lucide', nowHidden ? 'chevron-right' : 'chevron-down');
                refreshIcons();
            }
        });
    }

    // Parked tray fold
    const pHead = document.getElementById('parkedTrayHead');
    const pBody = document.getElementById('parkedTrayBody');
    const pLabel = document.getElementById('parkedTrayLabel');
    const pIcon = document.getElementById('parkedTrayIcon');
    if (pHead && pBody) {
        pHead.addEventListener('click', () => {
            const nowHidden = pBody.classList.toggle('hidden');
            pHead.setAttribute('aria-expanded', nowHidden ? 'false' : 'true');
            if (pLabel) pLabel.textContent = nowHidden ? 'Show' : 'Hide';
            if (pIcon) {
                pIcon.setAttribute('data-lucide', nowHidden ? 'chevron-right' : 'chevron-down');
                refreshIcons();
            }
        });
    }

    // Capture bar
    const capture = document.getElementById('captureInput');
    if (capture) {
        capture.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                commitCapture(capture);
            }
        });
    }

    wireFocus();

    // The now bar ticks on its own
    renderNowBlock();

    wireAccessibilityBehaviour();
});

// ---------- Accessibility wiring that has no other natural home ----------

function wireAccessibilityBehaviour() {
    const a11y = window.BokeaA11y;

    // Keyboard behaviour for the two topbar menus.
    if (a11y) {
        a11y.wireMenu(
            document.getElementById('profileAvatarBox'),
            document.getElementById('dropdownMenuBox'),
            { haspopup: 'menu' }
        );
        a11y.wireMenu(
            document.getElementById('notificationBellBox'),
            document.getElementById('notificationMenuBox'),
            { haspopup: 'true' }
        );
    }

    // Show/hide password. Typing a password you cannot check is a real barrier
    // for anyone with a motor or memory difficulty; the state is announced.
    document.querySelectorAll('.password-reveal').forEach(btn => {
        btn.addEventListener('click', () => {
            const field = document.getElementById(btn.getAttribute('data-reveals'));
            if (!field) return;
            const reveal = field.type === 'password';
            field.type = reveal ? 'text' : 'password';
            btn.setAttribute('aria-pressed', reveal ? 'true' : 'false');
            btn.firstChild.textContent = reveal ? 'Hide' : 'Show';
            announce(reveal ? 'Password shown.' : 'Password hidden.');
            field.focus();
        });
    });

    // Replay the tutorial, from Settings or from the account menu.
    const replay = () => {
        if (!window.BokeaTour) return;
        const menu = document.getElementById('dropdownMenuBox');
        if (menu) menu.classList.remove('show');
        window.BokeaTour.start({ reason: 'replay' });
    };
    const replayBtn = document.getElementById('replayTutorialBtn');
    if (replayBtn) replayBtn.addEventListener('click', replay);
    const replayMenuItem = document.getElementById('dropdownTutorialBtn');
    if (replayMenuItem) replayMenuItem.addEventListener('click', (e) => {
        e.preventDefault();
        replay();
    });

    // Keep the accessibility "reduce motion" choice and the in-app one in step.
    if (a11y && window.matchMedia) {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => applyUiPrefs();
        if (mq.addEventListener) mq.addEventListener('change', sync);
        else if (mq.addListener) mq.addListener(sync);
    }
    ['a11yMotion'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('change', () => applyUiPrefs());
    });

    syncTimeInputsClockFormat();
    renderDailyScheduleTimeline();
}
