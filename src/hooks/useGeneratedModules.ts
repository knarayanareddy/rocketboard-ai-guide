import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { sendAITask } from "@/lib/ai-client";
import { buildGenerateModuleEnvelope } from "@/lib/envelope-builder";
import type { EvidenceSpan } from "@/hooks/useEvidenceSpans";

export interface GeneratedSection {
  section_id: string;
  heading: string;
  markdown: string;
  learning_objectives?: string[];
  note_prompts?: string[];
  citations?: { span_id: string; path?: string; chunk_id?: string }[];
}

export interface GeneratedEndcap {
  reflection_prompts: string[];
  quiz_objectives: string[];
  ready_for_quiz_markdown: string;
  citations?: { span_id: string }[];
}

export interface GeneratedModuleData {
  module_key: string;
  title: string;
  description: string;
  estimated_minutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  track_key: string | null;
  audience: string | null;
  depth: string | null;
  sections: GeneratedSection[];
  endcap: GeneratedEndcap;
  key_takeaways: string[];
  evidence_index?: { topic: string; citations: { span_id: string }[] }[];
}

export interface GeneratedModuleRow {
  id: string;
  pack_id: string;
  module_key: string;
  module_revision: number;
  title: string;
  description: string | null;
  estimated_minutes: number | null;
  difficulty: string | null;
  track_key: string | null;
  audience: string | null;
  depth: string | null;
  module_data: GeneratedModuleData;
  status: string;
  created_at: string;
  updated_at: string;
}

async function fetchEvidenceSpans(packId: string, query: string, maxSpans: number): Promise<EvidenceSpan[]> {
  try {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/retrieve-spans`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ pack_id: packId, query, max_spans: maxSpans }),
      }
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.spans || [];
  } catch {
    return [];
  }
}

export function useGeneratedModules() {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel } = useRole();
  const queryClient = useQueryClient();

  // Fetch all generated modules for the pack
  const modulesQuery = useQuery({
    queryKey: ["generated_modules", currentPackId],
    queryFn: async () => {
      if (!currentPackId) return [];
      const { data, error } = await supabase
        .from("generated_modules")
        .select("*")
        .eq("pack_id", currentPackId)
        .eq("status", "published")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as GeneratedModuleRow[];
    },
    enabled: !!currentPackId,
  });

  // Fetch a single module
  const fetchModule = (moduleKey: string) => {
    return useQuery({
      queryKey: ["generated_module", currentPackId, moduleKey],
      queryFn: async () => {
        if (!currentPackId) return null;
        const { data, error } = await supabase
          .from("generated_modules")
          .select("*")
          .eq("pack_id", currentPackId)
          .eq("module_key", moduleKey)
          .order("module_revision", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        return data as unknown as GeneratedModuleRow | null;
      },
      enabled: !!currentPackId && !!moduleKey,
    });
  };

  // Generate a module via AI and save to DB
  const generateModule = useMutation({
    mutationFn: async (opts: {
      moduleKey: string;
      title: string;
      description?: string;
      trackKey?: string | null;
      difficulty?: string;
      estimatedMinutes?: number;
    }) => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");

      const spans = await fetchEvidenceSpans(
        currentPackId,
        `${opts.title} ${opts.description || ""}`,
        15
      );

      const envelope = buildGenerateModuleEnvelope({
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
        evidenceSpans: spans,
        moduleKey: opts.moduleKey,
        moduleTitle: opts.title,
        moduleDescription: opts.description,
        trackKey: opts.trackKey,
      });

      const result = await sendAITask(envelope);
      const moduleData = result.module as GeneratedModuleData;

      // Save to DB
      const { data, error } = await supabase
        .from("generated_modules")
        .upsert({
          pack_id: currentPackId,
          module_key: opts.moduleKey,
          module_revision: 1,
          title: moduleData.title || opts.title,
          description: moduleData.description || opts.description || null,
          estimated_minutes: moduleData.estimated_minutes || opts.estimatedMinutes || null,
          difficulty: moduleData.difficulty || opts.difficulty || null,
          track_key: moduleData.track_key || opts.trackKey || null,
          audience: moduleData.audience || null,
          depth: moduleData.depth || null,
          module_data: moduleData as any,
          status: "published",
        }, { onConflict: "pack_id,module_key,module_revision" })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as GeneratedModuleRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["generated_modules", currentPackId] });
    },
  });

  return {
    modules: modulesQuery.data || [],
    modulesLoading: modulesQuery.isLoading,
    fetchModule,
    generateModule,
  };
}
