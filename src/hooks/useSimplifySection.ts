import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { useAudiencePrefs } from "@/hooks/useAudiencePrefs";
import { sendAITask } from "@/lib/ai-client";
import { buildSimplifySectionEnvelope } from "@/lib/envelope-builder";

export interface SimplifiedSection {
  simplified_markdown: string;
  citations: { span_id: string; path?: string; chunk_id?: string }[];
  audience: string;
  depth: string;
}

async function fetchEvidenceSpans(packId: string, query: string): Promise<any[]> {
  try {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retrieve-spans`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ pack_id: packId, query: query.slice(0, 300), max_spans: 8 }),
      }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.spans || [];
  } catch {
    return [];
  }
}

export function useSimplifySection() {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel } = useRole();
  const { audience, depth } = useAudiencePrefs();
  const queryClient = useQueryClient();

  const simplifySection = useMutation({
    mutationFn: async (opts: {
      moduleKey: string;
      sectionId: string;
      originalMarkdown: string;
      trackKey?: string | null;
    }): Promise<SimplifiedSection> => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      // Check cache first
      const cacheKey = ["simplified_section", currentPackId, opts.moduleKey, opts.sectionId, audience, depth];
      const cached = queryClient.getQueryData<SimplifiedSection>(cacheKey);
      if (cached) return cached;

      const spans = await fetchEvidenceSpans(currentPackId, opts.originalMarkdown);

      const envelope = buildSimplifySectionEnvelope({
        auth: {
          user_id: user.id,
          org_id: currentPack?.org_id || null,
          roles: [],
          pack_access_level: packAccessLevel,
        },
        pack: {
          pack_id: currentPackId,
          pack_version: currentPack?.pack_version,
          title: currentPack?.title,
          description: currentPack?.description,
          language_mode: currentPack?.language_mode,
        },
        moduleKey: opts.moduleKey,
        sectionId: opts.sectionId,
        originalMarkdown: opts.originalMarkdown,
        trackKey: opts.trackKey,
        evidenceSpans: spans,
        audienceProfile: { audience, depth },
      });

      const result = await sendAITask(envelope);

      const simplified: SimplifiedSection = {
        simplified_markdown: result.simplified_markdown || opts.originalMarkdown,
        citations: result.citations || [],
        audience: result.audience || audience,
        depth: result.depth || depth,
      };

      // Cache the result
      queryClient.setQueryData(cacheKey, simplified);

      return simplified;
    },
  });

  // Read from cache
  const getCachedSimplification = (moduleKey: string, sectionId: string): SimplifiedSection | undefined => {
    const cacheKey = ["simplified_section", currentPackId, moduleKey, sectionId, audience, depth];
    return queryClient.getQueryData<SimplifiedSection>(cacheKey);
  };

  return {
    simplifySection,
    getCachedSimplification,
  };
}
