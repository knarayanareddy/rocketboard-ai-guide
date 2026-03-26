import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { ChunkPK, StableChunkId, ChunkRef, PackId, isUuidString, asChunkPK, asStableChunkId } from "@/types/brands";

export interface ChunkContent {
  id: ChunkPK; // Internal UUID
  chunk_id: StableChunkId; // Stable TEXT id
  chunk_pk: ChunkPK; // Unified alias for id
  stable_chunk_id: StableChunkId | null; // Unified alias for chunk_id
  content: string;
  path: string;
  start_line: number;
  end_line: number;
  metadata: Json | null;
  is_redacted: boolean | null;
}

/**
 * Strict regex for UUID v1-v5 detection
 * (Renamed or aliased to support branding)
 */
export function isUuidLike(s: string): s is ChunkPK {
  return isUuidString(s);
}

/**
 * Fetch a single chunk's content by chunk reference (UUID id OR text chunk_id)
 * Examples: 
 * - UUID: "550e8400-e29b-41d4-a716-446655440000"
 * - Stable: "C00001"
 */
async function fetchChunkContent(packId: PackId, chunkRef: ChunkRef): Promise<ChunkContent | null> {
  const isUuid = isUuidLike(chunkRef);
  const column = isUuid ? "id" : "chunk_id";

  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("id, chunk_id, content, path, start_line, end_line, metadata, is_redacted")
    .eq("pack_id", packId)
    .eq(column, chunkRef)
    .maybeSingle();

  if (!data || error) return null;

  return {
    ...data,
    id: data.id as ChunkPK,
    chunk_id: data.chunk_id as StableChunkId,
    chunk_pk: data.id as ChunkPK,
    stable_chunk_id: data.chunk_id as StableChunkId
  } as ChunkContent;
}

/**
 * Hook to fetch and cache evidence span content
 */
export function useEvidenceSpanContent(packId: PackId | null, chunkRef: ChunkRef | null) {
  return useQuery({
    queryKey: ["chunk-content", packId, chunkRef],
    queryFn: async () => {
      if (!packId || !chunkRef) return null;
      return fetchChunkContent(packId, chunkRef);
    },
    enabled: Boolean(packId && chunkRef),
    staleTime: 10 * 60 * 1000, 
    gcTime: 30 * 60 * 1000, 
  });
}

/**
 * Get a preview of the content (first N lines)
 */
export function getContentPreview(content: string, maxLines: number = 4): string {
  const lines = content.split("\n");
  const previewLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    previewLines.push("...");
  }
  return previewLines.join("\n");
}

/**
 * Batch fetch multiple chunks at once (resilient to mixed UUID/TEXT)
 */
export function useEvidenceSpanContents(packId: PackId | null, chunkRefs: ChunkRef[]) {
  return useQuery({
    queryKey: ["chunk-contents-batch", packId, [...chunkRefs].sort().join(",")],
    queryFn: async () => {
      if (!packId || chunkRefs.length === 0) return {};

      const uuidRefs = chunkRefs.filter(isUuidLike);
      const textRefs = chunkRefs.filter(ref => !isUuidLike(ref));

      let query = supabase
        .from("knowledge_chunks")
        .select("id, chunk_id, content, path, start_line, end_line, metadata, is_redacted")
        .eq("pack_id", packId);

      // Build OR filter for mixed identifiers
      if (uuidRefs.length > 0 && textRefs.length > 0) {
        query = query.or(`id.in.(${uuidRefs.join(",")}),chunk_id.in.(${textRefs.join(",")})`);
      } else if (uuidRefs.length > 0) {
        query = query.in("id", uuidRefs);
      } else {
        query = query.in("chunk_id", textRefs);
      }

      const { data, error } = await query;

      if (error) {
        console.error("[UI:BatchFetch] Error fetching chunks:", error);
        return {};
      }

      // Return as a map keyed by BOTH id and chunk_id
      const map: Record<string, ChunkContent> = {};
      for (const chunk of data || []) {
        const enriched = {
          ...chunk,
          id: chunk.id as ChunkPK,
          chunk_id: chunk.chunk_id as StableChunkId,
          chunk_pk: chunk.id as ChunkPK,
          stable_chunk_id: chunk.chunk_id as StableChunkId
        } as ChunkContent;
        map[chunk.id] = enriched;
        map[chunk.chunk_id] = enriched;
      }
      return map;
    },
    enabled: Boolean(packId && chunkRefs.length > 0),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
