import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface GuardResult {
  success: boolean;
  status?: number;
  error?: string;
  next_allowed_at?: string;
  retry_count?: number;
}

export async function validateIngestion(
  supabase: SupabaseClient,
  pack_id: string,
  source_id: string
): Promise<GuardResult> {
  const cooldownSeconds = parseInt(Deno.env.get("INGEST_SOURCE_COOLDOWN_SECONDS") || "3600");
  const serializePack = Deno.env.get("INGEST_PACK_SERIALIZE") !== "false";

  // 1. Check for 'processing' jobs (Concurrency)
  const { data: activeJobs, error: activeErr } = await supabase
    .from("ingestion_jobs")
    .select("id, source_id, status")
    .eq("pack_id", pack_id)
    .eq("status", "processing");

  if (activeErr) throw activeErr;

  if (activeJobs && activeJobs.length > 0) {
    if (serializePack) {
      return {
        success: false,
        status: 409,
        error: "Another ingestion is already in progress for this pack.",
      };
    }
    if (activeJobs.some(j => j.source_id === source_id)) {
      return {
        success: false,
        status: 409,
        error: "Ingestion already in progress for this source.",
      };
    }
  }

  // 2. Check Last Job State (Cooldown & Retry Count)
  const { data: lastJob, error: lastErr } = await supabase
    .from("ingestion_jobs")
    .select("status, completed_at, retry_count")
    .eq("source_id", source_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastErr) throw lastErr;

  let currentRetryCount = 0;
  if (lastJob) {
    if (lastJob.status === "failed") {
      currentRetryCount = (lastJob.retry_count || 0) + 1;
    } else if (lastJob.status === "completed" && lastJob.completed_at) {
      const lastCompleted = new Date(lastJob.completed_at).getTime();
      const now = Date.now();
      const elapsed = (now - lastCompleted) / 1000;

      if (elapsed < cooldownSeconds) {
        const nextAllowed = new Date(lastCompleted + cooldownSeconds * 1000).toISOString();
        return {
          success: false,
          status: 429,
          error: "Cooldown active. Please wait before re-ingesting this source.",
          next_allowed_at: nextAllowed,
        };
      }
    }
  }

  return { success: true, retry_count: currentRetryCount };
}

export async function checkPackChunkCap(
  supabase: SupabaseClient,
  pack_id: string
): Promise<GuardResult> {
  const maxChunks = parseInt(Deno.env.get("MAX_CHUNKS_PER_PACK") || "50000");

  const { count, error } = await supabase
    .from("knowledge_chunks")
    .select("*", { count: "exact", head: true })
    .eq("pack_id", pack_id);

  if (error) throw error;

  if (count !== null && count >= maxChunks) {
    return {
      success: false,
      status: 413,
      error: `Storage cap exceeded. Pack has reached the maximum limit of ${maxChunks} chunks.`,
    };
  }

  return { success: true };
}

export function getRunCap(): number {
  return parseInt(Deno.env.get("MAX_NEW_CHUNKS_PER_RUN") || "20000");
}
