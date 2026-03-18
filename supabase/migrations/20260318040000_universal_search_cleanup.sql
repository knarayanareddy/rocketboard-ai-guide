-- Phase 5: Universal Security Hardening & Legacy RPC Revocation
-- This migration ensures NO legacy search functions remain executable by non-privileged roles.

-- 1. Systematic Revocation of legacy search surfaces
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
          AND (
            p.proname LIKE 'match_chunks%' OR 
            p.proname LIKE 'search_chunks%' OR
            p.proname = 'hybrid_search' -- Legacy v1
          )
          AND p.proname != 'hybrid_search_v2' -- Keep the current hardened one
    ) LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM public, authenticated', r.nspname, r.proname, r.args);
        RAISE NOTICE 'Revoked EXECUTE on legacy function: %.%(%)', r.nspname, r.proname, r.args;
    END LOOP;
END $$;

-- 2. Lockdown run_analyze (Security Definer)
-- Restricted to service_role only
REVOKE EXECUTE ON FUNCTION public.run_analyze(TEXT) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.run_analyze(TEXT) TO service_role;

-- 3. Final sanity check on knowledge_chunks
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.knowledge_chunks IS 'Core knowledge repository. RLS enforced. Direct RPC access revoked for all legacy search surfaces.';
