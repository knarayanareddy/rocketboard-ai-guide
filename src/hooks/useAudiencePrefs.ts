import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import type { Audience, Depth } from "@/data/onboarding-data";

export type GlossaryDensity = "low" | "standard" | "high";

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
    mutationFn: async ({ audience, depth, glossary_density }: { audience: Audience; depth: Depth; glossary_density?: GlossaryDensity }) => {
      if (!user) return;
      const payload: any = {
        user_id: user.id,
        audience,
        depth,
        pack_id: currentPackId,
        updated_at: new Date().toISOString(),
      };
      if (glossary_density) payload.glossary_density = glossary_density;
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
    updatePrefs,
  };
}
