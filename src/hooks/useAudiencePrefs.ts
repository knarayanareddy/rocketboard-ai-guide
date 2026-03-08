import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import type { Audience, Depth } from "@/data/onboarding-data";

export type GlossaryDensity = "low" | "standard" | "high";
export type ExperienceLevel = "new" | "mid" | "senior";
export type OutputLanguage = string;

export interface LearnerProfile {
  learner_role: string | null;
  experience_level: ExperienceLevel | null;
}

export function useAudiencePrefs() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const { data: prefs } = useQuery({
    queryKey: ["audience_preferences", user?.id, currentPackId],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("audience_preferences")
        .select("*")
        .eq("user_id", user.id)
        .or(`pack_id.eq.${currentPackId},pack_id.is.null`)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updatePrefs = useMutation({
    mutationFn: async (opts: {
      audience: Audience;
      depth: Depth;
      glossary_density?: GlossaryDensity;
      learner_role?: string | null;
      experience_level?: ExperienceLevel | null;
      output_language?: string;
    }) => {
      if (!user) return;
      const payload: any = {
        user_id: user.id,
        audience: opts.audience,
        depth: opts.depth,
        pack_id: currentPackId,
        updated_at: new Date().toISOString(),
      };
      if (opts.glossary_density) payload.glossary_density = opts.glossary_density;
      if (opts.learner_role !== undefined) payload.learner_role = opts.learner_role;
      if (opts.experience_level !== undefined) payload.experience_level = opts.experience_level;
      if (opts.output_language !== undefined) payload.output_language = opts.output_language;
      const { error } = await supabase.from("audience_preferences").upsert(
        payload,
        { onConflict: "user_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audience_preferences", user?.id, currentPackId] });
    },
  });

  return {
    audience: (prefs?.audience as Audience) ?? "technical",
    depth: (prefs?.depth as Depth) ?? "standard",
    glossaryDensity: ((prefs as any)?.glossary_density as GlossaryDensity) ?? "standard",
    learnerRole: ((prefs as any)?.learner_role as string | null) ?? null,
    experienceLevel: ((prefs as any)?.experience_level as ExperienceLevel | null) ?? null,
    updatePrefs,
  };
}
