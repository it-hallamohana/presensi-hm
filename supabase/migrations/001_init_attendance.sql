-- =============================================================================
-- MIGRATION: 001_init_attendance.sql
-- PROJECT: Attendance & Daily Logbook (Isolated on `mall-survey` Supabase)
-- ISOLATION RULE: All tables prefixed with `att_`, buckets prefixed with `att-`.
-- Does NOT modify or touch any existing tables, buckets, or triggers.
-- =============================================================================

-- 1. TABLE: att_profiles
CREATE TABLE IF NOT EXISTS public.att_profiles (
    id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name text NOT NULL DEFAULT '',
    role_title text NOT NULL DEFAULT '',
    default_start_time time NOT NULL DEFAULT '08:00:00',
    default_end_time time NOT NULL DEFAULT '17:00:00',
    signature_url text,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. TABLE: att_approvers
CREATE TABLE IF NOT EXISTS public.att_approvers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name text NOT NULL,
    department_or_title text NOT NULL,
    is_default boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_att_approvers_user_id ON public.att_approvers(user_id);

-- 3. TABLE: att_logs
CREATE TABLE IF NOT EXISTS public.att_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    log_date date NOT NULL,
    work_mode text NOT NULL CHECK (work_mode IN ('WFO', 'WFA', 'OFF')),
    is_weekend_job boolean NOT NULL DEFAULT false,
    check_in time,
    check_out time,
    notes text,
    daily_activity text,
    attachment_url text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT att_logs_user_id_log_date_key UNIQUE (user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_att_logs_user_date ON public.att_logs(user_id, log_date);

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) FOR TABLES
-- =============================================================================

ALTER TABLE public.att_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.att_approvers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.att_logs ENABLE ROW LEVEL SECURITY;

-- Grant table access to authenticated role
GRANT SELECT, INSERT, UPDATE, DELETE ON public.att_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.att_approvers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.att_logs TO authenticated;

-- Policies for att_profiles
DROP POLICY IF EXISTS "att_profiles_select_own" ON public.att_profiles;
CREATE POLICY "att_profiles_select_own" ON public.att_profiles
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "att_profiles_insert_own" ON public.att_profiles;
CREATE POLICY "att_profiles_insert_own" ON public.att_profiles
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "att_profiles_update_own" ON public.att_profiles;
CREATE POLICY "att_profiles_update_own" ON public.att_profiles
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "att_profiles_delete_own" ON public.att_profiles;
CREATE POLICY "att_profiles_delete_own" ON public.att_profiles
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = id);

-- Policies for att_approvers
DROP POLICY IF EXISTS "att_approvers_select_own" ON public.att_approvers;
CREATE POLICY "att_approvers_select_own" ON public.att_approvers
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "att_approvers_insert_own" ON public.att_approvers;
CREATE POLICY "att_approvers_insert_own" ON public.att_approvers
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "att_approvers_update_own" ON public.att_approvers;
CREATE POLICY "att_approvers_update_own" ON public.att_approvers
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "att_approvers_delete_own" ON public.att_approvers;
CREATE POLICY "att_approvers_delete_own" ON public.att_approvers
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- Policies for att_logs
DROP POLICY IF EXISTS "att_logs_select_own" ON public.att_logs;
CREATE POLICY "att_logs_select_own" ON public.att_logs
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "att_logs_insert_own" ON public.att_logs;
CREATE POLICY "att_logs_insert_own" ON public.att_logs
    FOR INSERT TO authenticated
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "att_logs_update_own" ON public.att_logs;
CREATE POLICY "att_logs_update_own" ON public.att_logs
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = user_id)
    WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "att_logs_delete_own" ON public.att_logs;
CREATE POLICY "att_logs_delete_own" ON public.att_logs
    FOR DELETE TO authenticated
    USING ((SELECT auth.uid()) = user_id);

-- =============================================================================
-- STORAGE BUCKETS & RLS POLICIES
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'att-attachments',
    'att-attachments',
    true,
    10485760, -- 10MB limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'att-signatures',
    'att-signatures',
    true,
    5242880, -- 5MB limit
    ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS Policies for att-attachments (folder per user_id: {user_id}/{filename})
DROP POLICY IF EXISTS "att_attachments_select_own" ON storage.objects;
CREATE POLICY "att_attachments_select_own" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'att-attachments'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );

DROP POLICY IF EXISTS "att_attachments_insert_own" ON storage.objects;
CREATE POLICY "att_attachments_insert_own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'att-attachments'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );

DROP POLICY IF EXISTS "att_attachments_update_own" ON storage.objects;
CREATE POLICY "att_attachments_update_own" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'att-attachments'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    )
    WITH CHECK (
        bucket_id = 'att-attachments'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );

DROP POLICY IF EXISTS "att_attachments_delete_own" ON storage.objects;
CREATE POLICY "att_attachments_delete_own" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'att-attachments'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );

-- Storage RLS Policies for att-signatures (folder per user_id: {user_id}/{filename})
DROP POLICY IF EXISTS "att_signatures_select_own" ON storage.objects;
CREATE POLICY "att_signatures_select_own" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'att-signatures'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );

DROP POLICY IF EXISTS "att_signatures_insert_own" ON storage.objects;
CREATE POLICY "att_signatures_insert_own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'att-signatures'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );

DROP POLICY IF EXISTS "att_signatures_update_own" ON storage.objects;
CREATE POLICY "att_signatures_update_own" ON storage.objects
    FOR UPDATE TO authenticated
    USING (
        bucket_id = 'att-signatures'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    )
    WITH CHECK (
        bucket_id = 'att-signatures'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );

DROP POLICY IF EXISTS "att_signatures_delete_own" ON storage.objects;
CREATE POLICY "att_signatures_delete_own" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'att-signatures'
        AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
    );
