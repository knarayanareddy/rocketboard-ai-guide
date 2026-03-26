import { useMutation } from "@tanstack/react-query";
import { usePack } from "@/hooks/usePack";
import { fetchEvidenceSpans as fetchSpans } from "@/lib/fetch-spans";

export interface EvidenceSpan {
  span_id: string;
  path: string;
  chunk_id: string; // The primary identifier (Stable TEXT if possible, else UUID)
  chunk_pk: string; // Always the row UUID
  stable_chunk_id: string | null; // TEXT chunk_id if available
  start_line: number;
  end_line: number;
  text: string;
  metadata?: {
    entity_type?: string;
    entity_name?: string;
    signature?: string;
    source_id?: string;
    source_slug?: string;
    chunk_ref_kind?: "stable" | "uuid_fallback";
    [key: string]: any;
  };
}

export function useEvidenceSpans() {
  const { currentPackId } = usePack();

  const retrieveSpans = useMutation({
    mutationFn: async ({ query, maxSpans = 10, moduleKey, trackKey }: {
      query: string;
      maxSpans?: number;
      moduleKey?: string;
      trackKey?: string;
    }): Promise<EvidenceSpan[]> => {
      if (!currentPackId) throw new Error("No pack selected");
      return fetchSpans(currentPackId, query, maxSpans, { module_key: moduleKey, track_key: trackKey });
    },
  });

  return { retrieveSpans };
}
