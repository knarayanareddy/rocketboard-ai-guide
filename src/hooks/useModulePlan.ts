import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { useRole } from "@/hooks/useRole";
import { sendAITask } from "@/lib/ai-client";
import { buildModulePlannerEnvelope } from "@/lib/envelope-builder";
import type { EvidenceSpan } from "@/hooks/useEvidenceSpans";

export interface ModulePlanEntry {
  module_key: string;
  title: string;
  description: string;
  estimated_minutes: number;
  difficulty: "beginner" | "intermediate" | "advanced";
  rationale: string;
  citations: { span_id: string }[];
  track_key: string | null;
  audience: string | null;
  depth: string | null;
}

export interface DetectedSignal {
  signal_key: string;
  confidence: "high" | "medium" | "low";
  explanation: string;
  citations: { span_id: string }[];
}

export interface PlanTrack {
  track_key: string;
  title: string;
  description: string;
}

export interface ModulePlanData {
  type: "module_planner";
  request_id: string;
  pack_id: string;
  pack_version: number;
  generation_meta: { timestamp_iso: string; request_id: string };
  detected_signals: DetectedSignal[];
  tracks: PlanTrack[];
  module_plan: ModulePlanEntry[];
  contradictions: any[];
  warnings: string[];
}

export interface ModulePlanRow {
  id: string;
  pack_id: string;
  pack_version: number;
  plan_data: ModulePlanData;
  status: "draft" | "approved" | "generating" | "completed";
  created_by: string | null;
  created_at: string;
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

export function useModulePlan() {
  const { user } = useAuth();
  const { currentPack, currentPackId } = usePack();
  const { packAccessLevel } = useRole();
  const queryClient = useQueryClient();

  // Fetch latest plan for the pack
  const planQuery = useQuery({
    queryKey: ["module_plan", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("module_plans")
        .select("*")
        .eq("pack_id", currentPackId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as ModulePlanRow | null;
    },
    enabled: !!currentPackId,
  });

  // Generate a new plan via AI
  const generatePlan = useMutation({
    mutationFn: async (): Promise<ModulePlanData> => {
      if (!currentPackId) throw new Error("No pack selected");

      // Get broad evidence spans
      const spans = await fetchEvidenceSpans(
        currentPackId,
        "architecture setup configuration deployment infrastructure code structure",
        20
      );

      const envelope = buildModulePlannerEnvelope({
        auth: {
          user_id: user?.id || null,
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
      });

      const result = await sendAITask(envelope);
      return result as ModulePlanData;
    },
  });

  // Save plan to database
  const savePlan = useMutation({
    mutationFn: async (planData: ModulePlanData) => {
      if (!currentPackId || !user) throw new Error("Missing pack or user");
      const { data, error } = await supabase
        .from("module_plans")
        .insert({
          pack_id: currentPackId,
          pack_version: currentPack?.pack_version || 1,
          plan_data: planData as any,
          status: "draft",
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["module_plan", currentPackId] }),
  });

  // Approve a plan
  const approvePlan = useMutation({
    mutationFn: async (planId: string) => {
      const { error } = await supabase
        .from("module_plans")
        .update({ status: "approved" })
        .eq("id", planId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["module_plan", currentPackId] }),
  });

  return {
    plan: planQuery.data,
    planLoading: planQuery.isLoading,
    generatePlan,
    savePlan,
    approvePlan,
  };
}
