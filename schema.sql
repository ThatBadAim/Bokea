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
    task_id BIGINT NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
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
