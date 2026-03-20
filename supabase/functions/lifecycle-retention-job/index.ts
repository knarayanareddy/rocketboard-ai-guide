import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: any) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    const cronToken = Deno.env.get("CRON_AUTH_TOKEN");
    
    if (authHeader !== `Bearer ${cronToken}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const { pack_id, dry_run = false, day_override } = await req.json().catch(() => ({}));

    console.log(`[lifecycle-retention] Starting job... ${dry_run ? '(DRY RUN)' : ''}`);

    // 1. Get all packs and their policies
    let query = supabase.from("packs").select("id, organization_id, pack_lifecycle_policies(*)");
    if (pack_id) query = query.eq("id", pack_id);
    
    const { data: packs, error: packsErr } = await query;
    if (packsErr) throw packsErr;

    const summary: any[] = [];

    for (const pack of packs) {
      const policy = pack.pack_lifecycle_policies || {
        retention_rag_metrics_days: 90,
        retention_ingestion_jobs_days: 90,
        legal_hold: false
      };

      if (policy.legal_hold) {
        console.log(`[lifecycle-retention] Pack ${pack.id} is under Legal Hold. Skipping deletion.`);
        await supabase.from("lifecycle_audit_events").insert({
          pack_id: pack.id,
          action: "retention_cleanup",
          target_type: "table",
          parameters: { legal_hold: true, dry_run },
          rows_deleted: { rag_metrics: 0, ingestion_jobs: 0, ai_audit_events: 0 },
          status: "completed"
        });
        continue;
      }

      const rowsDeleted: any = { rag_metrics: 0, ingestion_jobs: 0, ai_audit_events: 0 };
      const now = day_override ? new Date(day_override) : new Date();

      // Table: rag_metrics
      const metricsLimitDate = new Date(now);
      metricsLimitDate.setDate(metricsLimitDate.getDate() - (policy.retention_rag_metrics_days || 90));

      if (dry_run) {
        const { count } = await supabase.from("rag_metrics")
          .select("*", { count: "exact", head: true })
          .eq("pack_id", pack.id)
          .lt("created_at", metricsLimitDate.toISOString());
        rowsDeleted.rag_metrics = count || 0;
      } else {
        // Batch delete for safety
        let hasMore = true;
        while (hasMore) {
          const { count, error } = await supabase.from("rag_metrics")
            .delete()
            .eq("pack_id", pack.id)
            .lt("created_at", metricsLimitDate.toISOString())
            .limit(1000); // 1k per batch
          
          if (error) throw error;
          rowsDeleted.rag_metrics += (count || 0);
          hasMore = (count || 0) === 1000;
        }
      }

      // Table: ingestion_jobs
      const jobsLimitDate = new Date(now);
      jobsLimitDate.setDate(jobsLimitDate.getDate() - (policy.retention_ingestion_jobs_days || 90));

      if (dry_run) {
        const { count } = await supabase.from("ingestion_jobs")
          .select("*", { count: "exact", head: true })
          .eq("pack_id", pack.id)
          .lt("started_at", jobsLimitDate.toISOString());
        rowsDeleted.ingestion_jobs = count || 0;
      } else {
        let hasMore = true;
        while (hasMore) {
          const { count, error } = await supabase.from("ingestion_jobs")
            .delete()
            .eq("pack_id", pack.id)
            .lt("started_at", jobsLimitDate.toISOString())
            .limit(1000);
          
          if (error) throw error;
          rowsDeleted.ingestion_jobs += (count || 0);
          hasMore = (count || 0) === 1000;
        }
      }

      // Table: ai_audit_events
      const auditLimitDate = new Date(now);
      auditLimitDate.setDate(auditLimitDate.getDate() - (policy.retention_audit_days || 90));

      if (dry_run) {
        const { count } = await supabase.from("ai_audit_events")
          .select("*", { count: "exact", head: true })
          .eq("pack_id", pack.id)
          .lt("created_at", auditLimitDate.toISOString());
        rowsDeleted.ai_audit_events = count || 0;
      } else {
        let hasMore = true;
        while (hasMore) {
          const { count, error } = await supabase.from("ai_audit_events")
            .delete()
            .eq("pack_id", pack.id)
            .lt("created_at", auditLimitDate.toISOString())
            .limit(1000);
          
          if (error) throw error;
          rowsDeleted.ai_audit_events += (count || 0);
          hasMore = (count || 0) === 1000;
        }
      }

      // Log Audit Event
      await supabase.from("lifecycle_audit_events").insert({
        pack_id: pack.id,
        action: "retention_cleanup",
        target_type: "table",
        parameters: { dry_run, day_reference: now.toISOString() },
        rows_deleted: rowsDeleted,
        status: "completed"
      });

      summary.push({ pack_id: pack.id, rows_deleted: rowsDeleted });
    }

    return new Response(JSON.stringify({ success: true, dry_run, summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[lifecycle-retention] Fatal Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
