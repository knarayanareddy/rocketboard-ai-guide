import { supabase } from "@/integrations/supabase/client";
import type { EvidenceSpan } from "@/hooks/useEvidenceSpans";

export async function fetchEvidenceSpans(
  packId: string,
  query: string,
  maxSpans: number = 10,
  extraParams?: { module_key?: string; track_key?: string },
): Promise<EvidenceSpan[]> {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return [];

    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retrieve-spans`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          pack_id: packId,
          query,
          max_spans: maxSpans,
          ...extraParams,
        }),
      }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.spans || [];
  } catch {
    return [];
  }
}
