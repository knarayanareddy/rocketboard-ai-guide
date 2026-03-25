CREATE OR REPLACE FUNCTION public.hybrid_search_v2(
  p_org_id uuid,
  p_pack_id uuid,
  p_query_text text,
  p_query_embedding vector,
  p_match_count integer,
  p_module_key text,
  p_track_key text
)
RETURNS TABLE(
  id uuid,
  chunk_id text,
  path text,
  content text,
  line_start integer,
  line_end integer,
  source_id uuid,
  entity_type text,
  entity_name text,
  signature text,
  score double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT *
  FROM public.hybrid_search_v2(
    p_org_id := p_org_id,
    p_pack_id := p_pack_id,
    p_query_text := p_query_text,
    p_query_embedding := p_query_embedding,
    p_match_count := p_match_count,
    p_match_threshold := NULL,
    p_module_key := p_module_key,
    p_track_key := p_track_key
  );
$function$;