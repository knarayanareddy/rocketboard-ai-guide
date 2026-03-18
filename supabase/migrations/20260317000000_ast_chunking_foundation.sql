-- Phase 1: Intelligent Ingestion Foundation (AST Metadata & Atomic Swaps)

-- 1. Metadata Schema Update for knowledge_chunks
ALTER TABLE knowledge_chunks
  ADD COLUMN IF NOT EXISTS entity_type TEXT,
  ADD COLUMN IF NOT EXISTS entity_name TEXT,
  ADD COLUMN IF NOT EXISTS signature TEXT,
  ADD COLUMN IF NOT EXISTS line_start INT,
  ADD COLUMN IF NOT EXISTS line_end INT,
  ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES knowledge_chunks(id),
  ADD COLUMN IF NOT EXISTS contextualized_content TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS generation_id UUID,
  ADD COLUMN IF NOT EXISTS imports TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS exported_names TEXT[] DEFAULT '{}';

-- 2. ENABLE RLS on all related tables natively avoiding UI leakages
ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- 3. Prevent 'mixed' retrieval utilizing a dedicated Active Generation ledger.
CREATE TABLE pack_active_generation (
  org_id UUID NOT NULL,
  pack_id UUID NOT NULL,
  active_generation_id UUID NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (org_id, pack_id)
);
ALTER TABLE pack_active_generation ENABLE ROW LEVEL SECURITY;

-- 4. Reindex Progress Tracking (Pack-aware)
CREATE TABLE reindex_progress (
  org_id UUID NOT NULL REFERENCES organizations(id),
  pack_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  chunks_processed INT DEFAULT 0,
  chunks_total INT DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  PRIMARY KEY (org_id, pack_id)
);
ALTER TABLE reindex_progress ENABLE ROW LEVEL SECURITY;

-- 5. FTS INDEX REBUILD: Use 'simple' to preserve code identifiers exactly.
ALTER TABLE knowledge_chunks DROP COLUMN IF EXISTS fts;
ALTER TABLE knowledge_chunks ADD COLUMN fts TSVECTOR
  GENERATED ALWAYS AS (
    to_tsvector('simple',
      COALESCE(content, '') || ' ' ||
      COALESCE(entity_name, '') || ' ' ||
      COALESCE(entity_name, '') || ' ' || 
      COALESCE(signature, '') || ' ' ||
      COALESCE(path, '')
    )
  ) STORED;

CREATE INDEX idx_chunks_fts ON knowledge_chunks USING gin(fts);
CREATE INDEX idx_chunks_path ON knowledge_chunks(path);
CREATE INDEX idx_chunks_generation ON knowledge_chunks(generation_id);
CREATE INDEX idx_chunks_exports ON knowledge_chunks USING gin(exported_names);

-- 6. Vector tracking + multi-tenant isolation compound scans
CREATE INDEX IF NOT EXISTS idx_chunks_org_pack_path ON knowledge_chunks(org_id, pack_id, path);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 7. RLS Policies Hardening
-- Chunks Select
CREATE POLICY "org_isolation_chunks" ON knowledge_chunks FOR SELECT USING ( org_id IN ( SELECT org_id FROM org_members WHERE user_id = auth.uid() ) );

-- reindex_progress: separate read vs write policies with WITH CHECK
DROP POLICY IF EXISTS org_isolation_progress ON reindex_progress;
CREATE POLICY reindex_progress_select ON reindex_progress FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY reindex_progress_insert ON reindex_progress FOR INSERT WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));
CREATE POLICY reindex_progress_update ON reindex_progress FOR UPDATE USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())) WITH CHECK (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- pack_active_generation: allow org members to read; restrict writes (backend/service role only)
DROP POLICY IF EXISTS org_isolation_active_pack ON pack_active_generation;
CREATE POLICY pack_active_generation_select ON pack_active_generation FOR SELECT USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- 8. ANALYZE function (Operational)
CREATE OR REPLACE FUNCTION run_analyze(table_name TEXT) 
RETURNS VOID 
LANGUAGE plpgsql 
SECURITY DEFINER 
AS $$
BEGIN
  EXECUTE 'ANALYZE ' || quote_ident(table_name);
END;
$$;
