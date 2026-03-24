import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface RemediationRow {
  id: string;
  module_key: string;
  section_id: string;
  original_content: string;
  proposed_content: string;
  diff_summary: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export function useRemediations(packId: string | null) {
  const qc = useQueryClient();

  // We fetch pending remediations for modules in this pack
  const { data: remediations, isLoading } = useQuery({
    queryKey: ["remediations", packId],
    queryFn: async () => {
      // Find modules in pack, then their pending remediations
      const { data: modules } = await supabase
        .from("generated_modules")
        .select("module_key")
        .eq("pack_id", packId);
        
      const keys = (modules || []).map(m => m.module_key);
      if (keys.length === 0) return [];

      const { data, error } = await (supabase
        .from("module_remediations" as any)
        .select("*")
        .in("module_key", keys)
        .eq("status", "pending")
        .order("created_at", { ascending: false }) as any);

      if (error) throw error;
      return (data || []) as RemediationRow[];
    },
    enabled: !!packId,
  });

  const resolveRemediation = useMutation({
    mutationFn: async ({ id, status, updated_content, module_key, section_id }: { id: string, status: "accepted" | "rejected", module_key: string, section_id: string, updated_content?: string }) => {
      // 1. Mark remediation as resolved
      const { error: rrErr } = await (supabase
        .from("module_remediations" as any)
        .update({ status } as any)
        .eq("id", id) as any);
      
      if (rrErr) throw rrErr;

      // 2. If accepted, update the actual module section content and mark section as no longer stale
      if (status === "accepted" && updated_content) {
        // Fetch module
        // This requires a custom edges/rpc or doing it on client. For simplicity, we fetch it, modify it, then update it.
        const { data: mod } = await supabase.from("generated_modules").select("id, module_data").eq("pack_id", packId).eq("module_key", module_key).single();
        if (mod && mod.module_data) {
          const modData: any = mod.module_data;
          if (modData.sections) {
            const secIdx = modData.sections.findIndex((s: any) => s.id === section_id);
            if (secIdx >= 0) {
              modData.sections[secIdx].content = updated_content;
              const { error: upErr } = await supabase.from("generated_modules").update({ module_data: modData }).eq("id", mod.id);
              if (upErr) throw upErr;
            }
          }
        }

        // 3. Unmark staleness in content_freshness
        await supabase.from("content_freshness").update({ is_stale: false }).eq("pack_id", packId).eq("module_key", module_key).eq("section_id", section_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["remediations"] });
      qc.invalidateQueries({ queryKey: ["generated_modules"] });
      qc.invalidateQueries({ queryKey: ["content_freshness"] });
    }
  });

  return { remediations: remediations || [], isLoading, resolveRemediation };
}
