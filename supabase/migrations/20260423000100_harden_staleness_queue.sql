-- Migration: Harden Staleness Check Queue
-- Adds observability columns and explicit RLS for worker operations.

-- 1. Add observability columns
ALTER TABLE public.staleness_check_queue 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS attempts INT NOT NULL DEFAULT 0;

-- 2. Add explicit RLS policies for management
-- Although service_role bypasses RLS, we add these for explicit documentation and auditability.
DROP POLICY IF EXISTS service_role_manage_queue ON public.staleness_check_queue;
CREATE POLICY service_role_manage_queue
    ON public.staleness_check_queue
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 3. Audit Event
INSERT INTO public.lifecycle_audit_events (action, details)
VALUES ('staleness_queue_hardened', '{"details": "Added started_at, finished_at, and attempts columns"}');
