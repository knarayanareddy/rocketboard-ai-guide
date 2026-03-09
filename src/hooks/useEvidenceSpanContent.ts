import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface ChunkContent {
  id: string;
  chunk_id: string;
  content: string;
  path: string;
  start_line: number;
  end_line: number;
  metadata: Json | null;
  is_redacted: boolean | null;
}

/**
 * Fetch a single chunk's content by chunk_id
 */
async function fetchChunkContent(packId: string, chunkId: string): Promise<ChunkContent | null> {
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("id, chunk_id, content, path, start_line, end_line, metadata, is_redacted")
    .eq("pack_id", packId)
    .eq("chunk_id", chunkId)
    .maybeSingle();

  if (error) {
    console.error("Error fetching chunk content:", error);
    return null;
  }

  return data;
}

/**
 * Hook to fetch and cache evidence span content
 */
export function useEvidenceSpanContent(packId: string | null, chunkId: string | null) {
  return useQuery({
    queryKey: ["chunk-content", packId, chunkId],
    queryFn: async () => {
      if (!packId || !chunkId) return null;
      return fetchChunkContent(packId, chunkId);
    },
    enabled: Boolean(packId && chunkId),
    staleTime: 10 * 60 * 1000, // 10 minutes - chunks don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache
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
 * Batch fetch multiple chunks at once
 */
export function useEvidenceSpanContents(packId: string | null, chunkIds: string[]) {
  return useQuery({
    queryKey: ["chunk-contents-batch", packId, chunkIds.sort().join(",")],
    queryFn: async () => {
      if (!packId || chunkIds.length === 0) return {};

      const { data, error } = await supabase
        .from("knowledge_chunks")
        .select("id, chunk_id, content, path, start_line, end_line, metadata, is_redacted")
        .eq("pack_id", packId)
        .in("chunk_id", chunkIds);

      if (error) {
        console.error("Error fetching chunk contents:", error);
        return {};
      }

      // Return as a map keyed by chunk_id
      const map: Record<string, ChunkContent> = {};
      for (const chunk of data || []) {
        map[chunk.chunk_id] = chunk;
      }
      return map;
    },
    enabled: Boolean(packId && chunkIds.length > 0),
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });
}
