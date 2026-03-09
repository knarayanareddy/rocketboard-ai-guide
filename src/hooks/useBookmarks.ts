import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export type BookmarkType = "module_section" | "glossary_term" | "path_step" | "ask_lead_question";

export interface Bookmark {
  id: string;
  user_id: string;
  pack_id: string;
  bookmark_type: BookmarkType;
  reference_key: string;
  label: string | null;
  created_at: string;
}

export function useBookmarks() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const qc = useQueryClient();

  const bookmarks = useQuery({
    queryKey: ["bookmarks", user?.id, currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookmarks")
        .select("*")
        .eq("user_id", user!.id)
        .eq("pack_id", currentPackId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Bookmark[];
    },
    enabled: !!user && !!currentPackId,
  });

  const toggleBookmark = useMutation({
    mutationFn: async ({ type, referenceKey, label }: { type: BookmarkType; referenceKey: string; label?: string }) => {
      const existing = (bookmarks.data ?? []).find(
        b => b.bookmark_type === type && b.reference_key === referenceKey
      );
      if (existing) {
        const { error } = await supabase.from("bookmarks").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bookmarks").insert({
          user_id: user!.id,
          pack_id: currentPackId,
          bookmark_type: type,
          reference_key: referenceKey,
          label: label ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const removeBookmark = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bookmarks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["bookmarks"] }),
  });

  const isBookmarked = (type: BookmarkType, referenceKey: string) =>
    (bookmarks.data ?? []).some(b => b.bookmark_type === type && b.reference_key === referenceKey);

  return {
    bookmarks: bookmarks.data ?? [],
    isLoading: bookmarks.isLoading,
    toggleBookmark,
    removeBookmark,
    isBookmarked,
  };
}
