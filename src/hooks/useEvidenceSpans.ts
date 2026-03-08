import { useMutation } from "@tanstack/react-query";
import { usePack } from "@/hooks/usePack";

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
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retrieve-spans`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            pack_id: currentPackId,
            query,
            max_spans: maxSpans,
            module_key: moduleKey,
            track_key: trackKey,
          }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Retrieval failed");
      }
      const data = await resp.json();
      return data.spans || [];
    },
  });

  return { retrieveSpans };
}
