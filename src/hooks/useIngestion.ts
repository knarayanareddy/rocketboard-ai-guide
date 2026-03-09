import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePack } from "@/hooks/usePack";
import { useEffect } from "react";

export function useIngestion(sourceId?: string) {
  const { currentPackId } = usePack();
  const queryClient = useQueryClient();

  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["ingestion_jobs", currentPackId, sourceId],
    queryFn: async () => {
      let query = supabase
        .from("ingestion_jobs")
        .select("*")
        .eq("pack_id", currentPackId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (sourceId) {
        query = query.eq("source_id", sourceId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!currentPackId,
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActive = data?.some((j: any) => j.status === "pending" || j.status === "processing");
      return hasActive ? 3000 : false;
    },
  });

  // Subscribe to realtime updates for ingestion jobs
  useEffect(() => {
    if (!currentPackId) return;

    const channel = supabase
      .channel(`ingestion-${currentPackId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "ingestion_jobs",
        filter: `pack_id=eq.${currentPackId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["ingestion_jobs", currentPackId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentPackId, queryClient]);

  const triggerIngestion = useMutation({
    mutationFn: async ({ sourceId, sourceType, sourceUri, documentContent, label, sourceConfig }: {
      sourceId: string;
      sourceType: string;
      sourceUri: string;
      documentContent?: string;
      label?: string;
      sourceConfig?: Record<string, any>;
    }) => {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-source`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            pack_id: currentPackId,
            source_id: sourceId,
            source_type: sourceType,
            source_uri: sourceUri,
            document_content: documentContent,
            label,
            source_config: sourceConfig,
          }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Failed" }));
        throw new Error(err.error || "Ingestion failed");
      }
      return resp.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ingestion_jobs", currentPackId] });
      queryClient.invalidateQueries({ queryKey: ["chunk_counts", currentPackId] });
      queryClient.invalidateQueries({ queryKey: ["pack_sources", currentPackId] });
    },
  });

  const latestJob = jobs[0] ?? null;
  const hasActiveJob = jobs.some((j) => j.status === "pending" || j.status === "processing");

  return { jobs, isLoading, triggerIngestion, latestJob, hasActiveJob };
}
