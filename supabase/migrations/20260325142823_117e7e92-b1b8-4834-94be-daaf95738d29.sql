
CREATE OR REPLACE FUNCTION public.hybrid_search_v2(
  p_org_id uuid,
  p_pack_id uuid,
  p_query_text text,
  p_query_embedding vector DEFAULT NULL,
  p_match_count integer DEFAULT 10,
  p_match_threshold double precision DEFAULT NULL,
  p_module_key text DEFAULT NULL,
  p_track_key text DEFAULT NULL
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
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  k constant int := 60;
BEGIN
  RETURN QUERY
  WITH vector_results AS (
    SELECT
      kc.id AS kid,
      kc.chunk_id,
      kc.path,
      kc.content,
      kc.start_line,
      kc.end_line,
      kc.source_id,
      (kc.metadata->>'entity_type')::text AS entity_type,
      (kc.metadata->>'entity_name')::text AS entity_name,
      (kc.metadata->>'signature')::text AS signature,
      1 - (kc.embedding <=> p_query_embedding) AS sim,
      ROW_NUMBER() OVER (ORDER BY kc.embedding <=> p_query_embedding) AS vec_rank
    FROM public.knowledge_chunks kc
    WHERE kc.pack_id = p_pack_id
      AND kc.is_redacted = false
      AND kc.embedding IS NOT NULL
      AND p_query_embedding IS NOT NULL
    ORDER BY kc.embedding <=> p_query_embedding
    LIMIT p_match_count * 3
  ),
  fts_results AS (
    SELECT
      kc.id AS kid,
      kc.chunk_id,
      kc.path,
      kc.content,
      kc.start_line,
      kc.end_line,
      kc.source_id,
      (kc.metadata->>'entity_type')::text AS entity_type,
      (kc.metadata->>'entity_name')::text AS entity_name,
      (kc.metadata->>'signature')::text AS signature,
      ts_rank(kc.fts, websearch_to_tsquery('english', p_query_text)) AS rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank(kc.fts, websearch_to_tsquery('english', p_query_text)) DESC) AS fts_r
    FROM public.knowledge_chunks kc
    WHERE kc.pack_id = p_pack_id
      AND kc.is_redacted = false
      AND kc.fts @@ websearch_to_tsquery('english', p_query_text)
    ORDER BY rank DESC
    LIMIT p_match_count * 3
  ),
  combined AS (
    SELECT
      COALESCE(v.kid, f.kid) AS kid,
      COALESCE(v.chunk_id, f.chunk_id) AS chunk_id,
      COALESCE(v.path, f.path) AS path,
      COALESCE(v.content, f.content) AS content,
      COALESCE(v.start_line, f.start_line) AS start_line,
      COALESCE(v.end_line, f.end_line) AS end_line,
      COALESCE(v.source_id, f.source_id) AS source_id,
      COALESCE(v.entity_type, f.entity_type) AS entity_type,
      COALESCE(v.entity_name, f.entity_name) AS entity_name,
      COALESCE(v.signature, f.signature) AS signature,
      (1.0 / (k + COALESCE(v.vec_rank, p_match_count * 3 + 1))) +
      (1.0 / (k + COALESCE(f.fts_r, p_match_count * 3 + 1))) AS rrf_score
    FROM vector_results v
    FULL OUTER JOIN fts_results f ON v.chunk_id = f.chunk_id
  )
  SELECT
    combined.kid,
    combined.chunk_id,
    combined.path,
    combined.content,
    combined.start_line,
    combined.end_line,
    combined.source_id,
    combined.entity_type,
    combined.entity_name,
    combined.signature,
    combined.rrf_score
  FROM combined
  WHERE (p_match_threshold IS NULL OR combined.rrf_score >= p_match_threshold)
  ORDER BY combined.rrf_score DESC
  LIMIT p_match_count;
END;
$function$;
