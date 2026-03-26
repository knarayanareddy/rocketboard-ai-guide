-- Verification Script for KG Retrieval v2 (SQL Editor)
-- 1. Setup (Requires real IDs from your DB)
-- REPLACE THESE WITH ACTUAL VALUES FROM YOUR DB
DO $$
DECLARE
  v_org_id UUID := '00000000-0000-0000-0000-000000000000'; 
  v_pack_id UUID := '00000000-0000-0000-0000-000000000000';
  v_seed_ids UUID[];
BEGIN
  -- 2. Pick 3 seed chunks from a recent generation
  SELECT array_slice(array_agg(id), 1, 3) INTO v_seed_ids
  FROM public.knowledge_chunks
  WHERE pack_id = v_pack_id
  LIMIT 3;

  RAISE NOTICE 'Testing kg_expand_v1 with seeds: %', v_seed_ids;

  -- 3. Call expansion
  -- Note: Testing as service_role usually requires running in a block where you set role
  -- or running it directly in the SQL editor which usually has high privs.
  -- But to test the role check, try:
  -- SET ROLE authenticated;
  -- SELECT * FROM public.kg_expand_v1(v_org_id, v_pack_id, v_seed_ids);
  -- (Expect failure above)
  
  -- Test with high privs/service_role logic
  PERFORM * FROM public.kg_expand_v1(v_org_id, v_pack_id, v_seed_ids);
  
  RAISE NOTICE 'kg_expand_v1 returned successfully.';
END $$;
