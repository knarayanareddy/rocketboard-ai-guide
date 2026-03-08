import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useNotes(moduleId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notes = [] } = useQuery({
    queryKey: ["learner_notes", user?.id, moduleId],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("learner_notes")
        .select("*")
        .eq("user_id", user.id)
        .eq("module_id", moduleId);
      if (error) throw error;
      return data;
    },
    enabled: !!user && !!moduleId,
  });

  const saveNote = useMutation({
    mutationFn: async ({ sectionId, content }: { sectionId: string; content: string }) => {
      if (!user) return;
      const { error } = await supabase.from("learner_notes").upsert(
        { user_id: user.id, module_id: moduleId, section_id: sectionId, content, updated_at: new Date().toISOString() },
        { onConflict: "user_id,module_id,section_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learner_notes", user?.id, moduleId] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async ({ sectionId }: { sectionId: string }) => {
      if (!user) return;
      const { error } = await supabase
        .from("learner_notes")
        .delete()
        .eq("user_id", user.id)
        .eq("module_id", moduleId)
        .eq("section_id", sectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["learner_notes", user?.id, moduleId] });
    },
  });

  const getNoteForSection = (sectionId: string): string => {
    const note = notes.find((n) => n.section_id === sectionId);
    return note?.content ?? "";
  };

  return { notes, saveNote, deleteNote, getNoteForSection };
}
