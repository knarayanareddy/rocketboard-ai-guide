DROP FUNCTION IF EXISTS public.hybrid_search_v2(uuid, uuid, text, vector, integer, double precision, text, text);
DROP FUNCTION IF EXISTS public.hybrid_search_v2(uuid, uuid, text, vector, integer, text, text);
DROP FUNCTION IF EXISTS public.hybrid_search_v2(uuid, uuid, text, vector, integer);

CREATE OR REPLACE FUNCTION public.hybrid_search_v2_impl(
  p_org_id uuid,
  p_pack_id uuid,
  p_query_text text,
  p_query_embedding vector,
  p_match_count integer,
  p_match_threshold double precision,
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
  WITH base AS (
    SELECT *
    FROM public.match_chunks_hybrid(
      query_embedding := p_query_embedding,
      query_text := p_query_text,
      match_count := p_match_count,
      target_pack_id := p_pack_id,
      path_filter := NULL
    )
  )
  SELECT
    kc.id,
    base.chunk_id,
    base.path,
    base.content,
    base.start_line AS line_start,
    base.end_line AS line_end,
    kc.source_id,
    (kc.metadata->>'entity_type')::text AS entity_type,
    (kc.metadata->>'entity_name')::text AS entity_name,
    (kc.metadata->>'signature')::text AS signature,
    base.rrf_score AS score
  FROM base
  JOIN public.knowledge_chunks kc
    ON kc.pack_id = p_pack_id
   AND kc.chunk_id = base.chunk_id
   AND kc.path = base.path
   AND kc.start_line = base.start_line
   AND kc.end_line = base.end_line
  WHERE (p_match_threshold IS NULL OR base.rrf_score >= p_match_threshold)
    AND (p_module_key IS NULL OR COALESCE(kc.metadata->>'module_key', '') = p_module_key)
    AND (p_track_key IS NULL OR COALESCE(kc.metadata->>'track_key', '') = p_track_key)
  ORDER BY base.rrf_score DESC
  LIMIT p_match_count;
$function$;

CREATE OR REPLACE FUNCTION public.hybrid_search_v2(
  p_org_id uuid,
  p_pack_id uuid,
  p_query_text text,
  p_query_embedding vector,
  p_match_count integer
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
  SELECT * FROM public.hybrid_search_v2_impl(
    p_org_id,
    p_pack_id,
    p_query_text,
    p_query_embedding,
    p_match_count,
    NULL,
    NULL,
    NULL
  );
$function$;

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
  SELECT * FROM public.hybrid_search_v2_impl(
    p_org_id,
    p_pack_id,
    p_query_text,
    p_query_embedding,
    p_match_count,
    NULL,
    p_module_key,
    p_track_key
  );
$function$;

CREATE OR REPLACE FUNCTION public.hybrid_search_v2(
  p_org_id uuid,
  p_pack_id uuid,
  p_query_text text,
  p_query_embedding vector,
  p_match_count integer,
  p_match_threshold double precision,
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
  SELECT * FROM public.hybrid_search_v2_impl(
    p_org_id,
    p_pack_id,
    p_query_text,
    p_query_embedding,
    p_match_count,
    p_match_threshold,
    p_module_key,
    p_track_key
  );
$function$;