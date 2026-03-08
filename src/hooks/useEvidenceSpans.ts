import { useMutation } from "@tanstack/react-query";
import { usePack } from "@/hooks/usePack";
import { fetchEvidenceSpans as fetchSpans } from "@/lib/fetch-spans";

export interface EvidenceSpan {
  span_id: string;
  path: string;
  chunk_id: string;
  start_line: number;
  end_line: number;
  text: string;
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
