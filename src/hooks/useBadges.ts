import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";
import { getBadgeDefinition } from "@/lib/badges";
import { toast } from "sonner";

export function useBadges() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const { data: badges = [] } = useQuery({
    queryKey: ["learner_badges", user?.id, currentPackId],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("learner_badges")
        .select("*")
        .eq("user_id", user.id)
        .eq("pack_id", currentPackId!)
        .order("earned_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!currentPackId,
  });

  const earnedKeys = new Set(badges.map(b => b.badge_key));

  const awardBadge = useMutation({
    mutationFn: async (badgeKey: string) => {
      if (!user || !currentPackId || earnedKeys.has(badgeKey)) return null;
      const { error } = await supabase.from("learner_badges").insert({
        user_id: user.id,
        pack_id: currentPackId,
        badge_key: badgeKey,
      });
      if (error) throw error;
      return badgeKey;
    },
    onSuccess: (key) => {
      queryClient.invalidateQueries({ queryKey: ["learner_badges", user?.id, currentPackId] });
      if (key) {
        const def = getBadgeDefinition(key);
        if (def) {
          toast.success(`${def.emoji} Badge Unlocked: ${def.label}`, { description: def.description });
        }
      }
    },
  });

  const hasBadge = (key: string) => earnedKeys.has(key);

  return { badges, hasBadge, awardBadge };
}
