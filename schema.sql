-- ==========================================================
-- Bokeà: Supabase PostgreSQL Schema & Security Policies (RLS)
-- ==========================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Custom Types / Enums
DO $$ BEGIN
    CREATE TYPE sector_type AS ENUM (
        'HealthAndVitality',
        'CareerAndFinance',
        'RelationshipsAndSocial',
        'MindAndEnvironment'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE interval_type AS ENUM (
        'IntervalBased',
        'FixedDate',
        'Workdays'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Upgrade path for existing interval_type enums
ALTER TYPE interval_type ADD VALUE IF NOT EXISTS 'Workdays';

DO $$ BEGIN
    CREATE TYPE task_state AS ENUM (
        'Green',
        'Amber',
        'Red'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Profiles Table (Extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    wake_up_time TEXT,
    bed_time TEXT,
    work_start_time TEXT,
    work_end_time TEXT,
    work_days TEXT[],
    is_setup_completed BOOLEAN DEFAULT FALSE,
    has_completed_tutorial BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Additive upgrades for projects created before these columns existed.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS has_completed_tutorial BOOLEAN DEFAULT FALSE;

-- Profile fields. All optional, all the user's own: Bokeà has no feed and no
-- other users to show them to, so none of this is ever read by anyone else.
-- date_of_birth is a DATE rather than a timestamp because a birthday belongs to
-- a calendar, not to an instant that can slide across a timezone boundary.
-- Age is derived on read and deliberately not stored: a stored age is wrong for
-- one day a year, every year.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pronouns TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;
-- Free text, not an enum: the list of genders is not ours to close.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS time_zone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
-- A 256px square as a data URL, resized in the browser before it is sent. No
-- upload bucket to secure, serve or garbage-collect for a single small avatar.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_data_url TEXT;

-- Guards, not quality bars: they stop a mistyped year or a whole photo library
-- from being written, and leave everything else to the person filling it in.
DO $$ BEGIN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_dob_sane
        CHECK (date_of_birth IS NULL
               OR (date_of_birth <= CURRENT_DATE AND date_of_birth >= DATE '1900-01-01'));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_bio_length
        CHECK (bio IS NULL OR char_length(bio) <= 400);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_avatar_sane
        CHECK (avatar_data_url IS NULL
               OR (avatar_data_url LIKE 'data:image/%' AND char_length(avatar_data_url) <= 1400000));
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Trigger: Automatically create a profile whenever a new user signs up in Supabase Auth.
--
-- This inserts a profile row and nothing else. No starter tasks, no sample
-- history, no default schedule: a new account is empty until its owner puts
-- something in it. The onboarding flow in the app fills in the schedule, and
-- the tutorial only adds example tasks if the user explicitly asks for them.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, first_name)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'first_name', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 4. Tasks Table
CREATE TABLE IF NOT EXISTS public.tasks (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    sector sector_type NOT NULL,
    interval_type interval_type NOT NULL,
    interval_days INTEGER,
    due_date TIMESTAMPTZ,
    due_time TEXT,                          -- e.g. '08:30' or '14:00'
    time_slot TEXT DEFAULT 'anytime',        -- 'morning', 'afternoon', 'evening', 'anytime'
    duration_minutes INTEGER DEFAULT 0,     -- estimated task duration in minutes
    notify_pref TEXT DEFAULT 'digest',       -- 'digest' or 'silent'
    is_archived BOOLEAN DEFAULT FALSE,      -- archive/pause habit without destroying history
    is_sample BOOLEAN DEFAULT FALSE,        -- example task the user opted into during the tutorial
    is_commitment BOOLEAN NOT NULL DEFAULT FALSE, -- hard commitment (allowed to turn red)
    last_completed_at TIMESTAMPTZ,
    snoozed_until TIMESTAMPTZ,
    state task_state NOT NULL DEFAULT 'Green',
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Task Completion Logs Table
CREATE TABLE IF NOT EXISTS public.task_completion_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    -- Nullable, and SET NULL on delete: a completion is part of the day it
    -- happened on, and deleting the task must not rewrite that day's history.
    task_id BIGINT REFERENCES public.tasks(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- 6. Push Subscriptions Table
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT FALSE;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS is_commitment BOOLEAN NOT NULL DEFAULT FALSE;

-- 7. Query Performance Indexes
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sector ON public.tasks(sector);
CREATE INDEX IF NOT EXISTS idx_tasks_state ON public.tasks(state);
CREATE INDEX IF NOT EXISTS idx_tasks_display_order ON public.tasks(display_order);
CREATE INDEX IF NOT EXISTS idx_logs_task_id ON public.task_completion_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_logs_user_id ON public.task_completion_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_logs_completed_at ON public.task_completion_logs(completed_at);
CREATE INDEX IF NOT EXISTS idx_push_user_id ON public.push_subscriptions(user_id);

-- 8. Enable Row-Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_completion_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 9. RLS Security Policies
-- Profiles Policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

-- Tasks Policies
DROP POLICY IF EXISTS "Users can view own tasks" ON public.tasks;
CREATE POLICY "Users can view own tasks" ON public.tasks
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own tasks" ON public.tasks;
CREATE POLICY "Users can insert own tasks" ON public.tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
CREATE POLICY "Users can update own tasks" ON public.tasks
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks" ON public.tasks
    FOR DELETE USING (auth.uid() = user_id);

-- Task Completion Logs Policies
DROP POLICY IF EXISTS "Users can view own logs" ON public.task_completion_logs;
CREATE POLICY "Users can view own logs" ON public.task_completion_logs
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own logs" ON public.task_completion_logs;
CREATE POLICY "Users can insert own logs" ON public.task_completion_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own logs" ON public.task_completion_logs;
CREATE POLICY "Users can delete own logs" ON public.task_completion_logs
    FOR DELETE USING (auth.uid() = user_id);

-- Push Subscriptions Policies
DROP POLICY IF EXISTS "Users can view own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can view own push subscriptions" ON public.push_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can insert own push subscriptions" ON public.push_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can delete own push subscriptions" ON public.push_subscriptions
    FOR DELETE USING (auth.uid() = user_id);

-- ==========================================================
-- 10. Sync & consistency upgrades (2026-09-13)
-- Safe to run more than once. On an existing project, run this whole section
-- in the Supabase SQL editor. The app works without it and falls back to its
-- older behaviour until it has been run.
-- ==========================================================

-- 10a. Completions outlive their task.
-- ON DELETE CASCADE removed a task's completion logs with it, so deleting a
-- finished habit took its ticks out of past days and could break a streak
-- after the fact.
ALTER TABLE public.task_completion_logs ALTER COLUMN task_id DROP NOT NULL;
ALTER TABLE public.task_completion_logs DROP CONSTRAINT IF EXISTS task_completion_logs_task_id_fkey;
ALTER TABLE public.task_completion_logs
    ADD CONSTRAINT task_completion_logs_task_id_fkey
    FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

-- 10b. updated_at that actually moves.
-- The client sends the updated_at it last saw when saving an edit, and the save
-- only applies if the row still has it. That stops a form opened before a change
-- on another device from silently putting the old values back.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_touch_updated_at ON public.tasks;
CREATE TRIGGER tasks_touch_updated_at
    BEFORE UPDATE ON public.tasks
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS profiles_touch_updated_at ON public.profiles;
CREATE TRIGGER profiles_touch_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 10c. Ticking and unticking as one transaction.
-- Done from the browser these were two requests (write the log, then update the
-- task), and a failure between them left the two disagreeing. SECURITY INVOKER,
-- so the RLS policies above still decide what the caller may touch.
CREATE OR REPLACE FUNCTION public.complete_task(p_task_id BIGINT, p_notes TEXT DEFAULT NULL)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_task public.tasks;
    v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
    SELECT * INTO v_task
    FROM public.tasks
    WHERE id = p_task_id AND user_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
    END IF;

    INSERT INTO public.task_completion_logs (task_id, user_id, completed_at, notes)
    VALUES (p_task_id, auth.uid(), v_now, p_notes);

    UPDATE public.tasks
    SET last_completed_at = v_now,
        snoozed_until = NULL,
        state = 'Green',
        due_date = CASE
            WHEN interval_type = 'IntervalBased'
                THEN v_now + make_interval(days => COALESCE(interval_days, 1))
            ELSE due_date
        END
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$;

CREATE OR REPLACE FUNCTION public.uncomplete_task(p_task_id BIGINT)
RETURNS public.tasks
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_task public.tasks;
    v_prev TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_task
    FROM public.tasks
    WHERE id = p_task_id AND user_id = auth.uid()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Task not found' USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.task_completion_logs
    WHERE id = (
        SELECT id FROM public.task_completion_logs
        WHERE task_id = p_task_id
        ORDER BY completed_at DESC
        LIMIT 1
    );

    SELECT completed_at INTO v_prev
    FROM public.task_completion_logs
    WHERE task_id = p_task_id
    ORDER BY completed_at DESC
    LIMIT 1;

    UPDATE public.tasks
    SET last_completed_at = v_prev,
        due_date = CASE
            WHEN interval_type = 'IntervalBased'
                THEN COALESCE(v_prev, created_at) + make_interval(days => COALESCE(interval_days, 1))
            ELSE due_date
        END
    WHERE id = p_task_id
    RETURNING * INTO v_task;

    RETURN v_task;
END;
$$;

REVOKE ALL ON FUNCTION public.complete_task(BIGINT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.uncomplete_task(BIGINT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_task(BIGINT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.uncomplete_task(BIGINT) TO authenticated;

-- 10d. Preferences that follow the account (theme, clock format, default
-- snooze, display switches). Written and read by the app as one JSON object.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences JSONB;

-- Tell the API about the new functions and column straight away.
NOTIFY pgrst, 'reload schema';
