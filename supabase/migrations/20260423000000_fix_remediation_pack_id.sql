-- Migration: Fix Remediation pack_id and enforce NOT NULL
-- This migration ensures all remediation drafts are visible under pack-scoped RLS.

-- 1. Ensure pack_id column exists (Safety check, previously added in security migrations)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'module_remediations' AND column_name = 'pack_id') THEN
        ALTER TABLE public.module_remediations ADD COLUMN pack_id uuid REFERENCES public.packs(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 2. Backfill missing pack_id values from generated_modules
-- We join on module_key. While module_key is not globally unique, 
-- it is the only viable link for orphaned legacy rows.
UPDATE public.module_remediations mr
SET pack_id = subquery.pack_id
FROM (
    SELECT module_key, pack_id
    FROM public.generated_modules
    -- In case of duplicate keys across packs, we pick the most recently active pack
    -- as it is the most likely parent of a pending remediation.
    ORDER BY created_at DESC
) AS subquery
WHERE mr.module_key = subquery.module_key
  AND mr.pack_id IS NULL;

-- 3. Enforce Data Integrity
-- After backfilling, all future remediation drafts must have a pack_id.
ALTER TABLE public.module_remediations ALTER COLUMN pack_id SET NOT NULL;

-- 4. Optimized Index
-- Re-verify performance index for RLS lookup.
CREATE INDEX IF NOT EXISTS idx_module_remediations_pack_id ON public.module_remediations(pack_id);


