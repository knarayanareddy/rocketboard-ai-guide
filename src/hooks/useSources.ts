import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePack } from "@/hooks/usePack";

export function useSources() {
  const { user } = useAuth();
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const { data: sources = [], isLoading } = useQuery({
    queryKey: ["pack_sources", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pack_sources")
        .select("*")
        .eq("pack_id", currentPackId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!currentPackId,
  });

  const addSource = useMutation({
    mutationFn: async ({ sourceType, sourceUri, label, sourceConfig }: {
      sourceType: string;
      sourceUri: string;
      label?: string;
      sourceConfig?: Record<string, any>;
    }) => {
      const insertData: any = {
        pack_id: currentPackId,
        source_type: sourceType,
        source_uri: sourceUri,
        label: label || null,
      };
      if (sourceConfig) {
        insertData.source_config = sourceConfig;
      }
      const { data, error } = await supabase
        .from("pack_sources")
        .insert(insertData)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pack_sources", currentPackId] });
    },
  });

  const deleteSource = useMutation({
    mutationFn: async (sourceId: string) => {
      const { error } = await supabase
        .from("pack_sources")
        .delete()
        .eq("id", sourceId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pack_sources", currentPackId] });
    },
  });

  // Get chunk count per source
  const { data: chunkCounts = {} } = useQuery({
    queryKey: ["chunk_counts", currentPackId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("knowledge_chunks")
        .select("source_id")
        .eq("pack_id", currentPackId);
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((c) => {
        counts[c.source_id] = (counts[c.source_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!currentPackId,
  });

  return { sources, isLoading, addSource, deleteSource, chunkCounts };
}
