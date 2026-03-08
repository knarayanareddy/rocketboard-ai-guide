import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function usePendingInvites(packId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: invites = [], isLoading } = useQuery({
    queryKey: ["pending_invites", packId],
    queryFn: async () => {
      if (!packId) return [];
      const { data, error } = await supabase
        .from("pending_invites")
        .select("*")
        .eq("pack_id", packId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!packId,
  });

  const sendInvite = useMutation({
    mutationFn: async ({ email, accessLevel }: { email: string; accessLevel: string }) => {
      if (!packId || !user) throw new Error("Missing pack or user");

      // Check if the email matches an existing user
      // We'll use the profiles table — display_name is set to email on signup
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .ilike("display_name", email.trim());

      if (profiles && profiles.length > 0) {
        // User exists — check if already a member
        const { data: existing } = await supabase
          .from("pack_members")
          .select("id")
          .eq("pack_id", packId)
          .eq("user_id", profiles[0].user_id)
          .maybeSingle();

        if (existing) throw new Error("User is already a member of this pack.");

        const { error } = await supabase.from("pack_members").insert({
          pack_id: packId,
          user_id: profiles[0].user_id,
          access_level: accessLevel,
        });
        if (error) throw error;
        return { status: "added" as const };
      } else {
        // Store pending invite
        const { error } = await supabase.from("pending_invites").upsert({
          pack_id: packId,
          email: email.trim().toLowerCase(),
          access_level: accessLevel,
          invited_by: user.id,
        }, { onConflict: "pack_id,email" });
        if (error) throw error;
        return { status: "pending" as const };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_invites", packId] });
      queryClient.invalidateQueries({ queryKey: ["pack_members_list", packId] });
    },
  });

  const deleteInvite = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.from("pending_invites").delete().eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending_invites", packId] });
    },
  });

  return { invites, isLoading, sendInvite, deleteInvite };
}
