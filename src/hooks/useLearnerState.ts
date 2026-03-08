import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useLearnerState() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: learnerState } = useQuery({
    queryKey: ["learner_state", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("learner_state")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const updateLastOpened = useMutation({
    mutationFn: async ({ moduleId, trackKey }: { moduleId: string; trackKey?: string }) => {
      if (!user) return;
      const { error } = await supabase.from("learner_state").upsert(
        {
          user_id: user.id,
          last_opened_module_id: moduleId,
          last_opened_track_key: trackKey ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learner_state", user?.id] });
    },
  });

  return {
    lastOpenedModuleId: learnerState?.last_opened_module_id ?? null,
    lastOpenedTrackKey: learnerState?.last_opened_track_key ?? null,
    updateLastOpened,
  };
}
