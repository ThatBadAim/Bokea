# Next steps — sync fixes (13 Sep 2026)

The code changes are done but **not committed or deployed**, and one part needs
a database change that only you can run. In order:

## 1. Run the database migration (Supabase)

1. Open your project in the Supabase dashboard → **SQL Editor** → New query.
2. From `schema.sql`, copy **section 10** (from the line
   `-- 10. Sync & consistency upgrades (2026-09-13)` to the end of the file),
   paste it, and press **Run**. It is safe to run more than once.
3. Check it worked:

   ```sql
   select proname from pg_proc where proname in ('complete_task', 'uncomplete_task');       -- 2 rows
   select column_name from information_schema.columns
    where table_name = 'profiles' and column_name = 'preferences';                           -- 1 row
   select tgname from pg_trigger where tgname = 'tasks_touch_updated_at';                    -- 1 row
   ```

What it turns on:

| Part | What it fixes |
| --- | --- |
| 10a | Deleting a task no longer deletes its past ticks, so old days and streaks stop changing after the fact. |
| 10b | `updated_at` now changes on every edit, which lets the app notice an edit form that is out of date. |
| 10c | `complete_task` / `uncomplete_task` save a tick or untick as one all-or-nothing write. |
| 10d | `profiles.preferences`, so theme, clock format, default snooze and display switches follow your account. |

**The app works before you run it.** Until then it quietly falls back to the old
behaviour for each of those four things (two separate writes per tick, last save
wins, preferences stay per device, deleting a task still removes its history).

If 10a errors on the foreign key, the constraint has a different name in your
project. Find it and swap the name into the `DROP CONSTRAINT` line:

```sql
select conname from pg_constraint
 where conrelid = 'public.task_completion_logs'::regclass and contype = 'f';
```

## 2. Commit and deploy

Changed files: `Bokeà/wwwroot/js/app.js`, `Bokeà/wwwroot/js/onboarding.js`,
`Bokeà/wwwroot/sw.js`, `schema.sql`, plus refreshed `graphify-out/`.
Deploy however you normally do (push to the branch Vercel builds from).

The service worker cache was bumped to `bokea-v37`. Phones with the app installed
switch to it after one or two reloads, which also clears the old cached Supabase
responses.

## 3. Check it on two devices

Signed in to the same account on a phone and a laptop:

- [ ] Tick a task on the phone. The laptop shows it ticked within a minute, or straight away when you switch back to its tab.
- [ ] Untick it on the laptop. The phone follows.
- [ ] Tick a dated one-off task before its due day. It is still ticked the next morning.
- [ ] Add a new daily habit. Your streak and past days in the chart do not drop.
- [ ] Change your work hours in Settings on one device. The other device's timeline updates without a reload.
- [ ] Switch dark theme on one device. The other follows (needs step 1).
- [ ] Open a task's Edit form on the laptop, change the same task on the phone, then save on the laptop. You get "changed on another device" instead of the phone's change being overwritten (needs step 1).
- [ ] Bell → Clear all. The notifications go, but the late tasks are still on the Today screen.

## 4. Push notifications (needs building)

Push notifications cannot currently fire. The app saves subscriptions to
Supabase's `push_subscriptions` table, but the only code that sends pushes is
the .NET `TaskWatchdogService`. It reads its own SQLite database (which this
frontend never writes to) and isn't part of the Vercel deploy.

The usual way to fix this on Supabase:

1. Create a **Supabase Edge Function** that reads `tasks` and `push_subscriptions`,
   works out which tasks have just become due or late, and sends a Web Push to
   each subscription (delete subscriptions that return 404/410).
2. Store the **VAPID private key** as a function secret (`supabase secrets set`).
   It has to be the partner of `VAPID_PUBLIC_KEY` in `Bokeà/wwwroot/js/config.js`.
   Never put it in the frontend.
3. Run it on a schedule (e.g. every 15 minutes) with `pg_cron` + `pg_net`, or
   Supabase's scheduled functions.
4. Record when each task was last notified so a late task isn't pushed every 15 minutes.

Alternatively, host the .NET service somewhere and point it at the Supabase
Postgres database instead of SQLite. That's a bigger change, because its models
and auth assume its own database.

## 5. Known limits and choices made

- **Background refresh is a poll**: once a minute while the app is on screen, plus immediately on returning to it or coming back online. For instant updates, enable Supabase Realtime on `tasks` and subscribe to it; the refresh code already copes with extra reloads.
- **A ticked one-off stays done even if you give it a new date later.** Untick it to reopen it.
- **"Clear all" dismissals are per device.** A dismissed notification comes back by itself once the task changes.
- **Best streak is per device** (now also per account). It isn't part of synced preferences.
- **History already lost to deleted tasks can't be recovered.** 10a only protects deletions from now on.
