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
    if (!authHeader) throw new Error("Missing Authorization header");

    const { data: { user }, error: authError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authError || !user) throw new Error("Unauthorized");

    const { pack_id, source_id, mode = "dry_run" } = await req.json().catch(() => ({}));

    if (!pack_id || !source_id) {
      throw new Error("Missing pack_id or source_id");
    }

    // 1. Author Access Check
    const { data: hasAccess } = await supabase.rpc("has_pack_access", {
      u_id: user.id,
      p_id: pack_id,
      p_role: "author"
    });

    if (!hasAccess) throw new Error("Insufficient permissions (Author required)");

    // 2. Verify Source Context
    const { data: source, error: sourceErr } = await supabase
      .from("pack_sources")
      .select("id, type, config")
      .eq("id", source_id)
      .eq("pack_id", pack_id)
      .single();

    if (sourceErr || !source) {
      return new Response(JSON.stringify({ error: "Source not found for this pack" }), { 
        status: 404, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    // 3. Compute Counts
    const { count: chunkCount } = await supabase
      .from("knowledge_chunks")
      .select("*", { count: "exact", head: true })
      .eq("pack_id", pack_id)
      .eq("source_id", source_id);

    const { count: jobCount } = await supabase
      .from("ingestion_jobs")
      .select("*", { count: "exact", head: true })
      .eq("pack_id", pack_id)
      .eq("source_id", source_id);

    const counts = {
      knowledge_chunks: chunkCount || 0,
      ingestion_jobs: jobCount || 0
    };

    let result = counts;
    let status = "completed";
    let errorMsg = null;

    // 4. Execute if requested
    if (mode === "execute" && (counts.knowledge_chunks > 0 || counts.ingestion_jobs > 0)) {
      try {
        const { data, error } = await supabase.rpc("purge_source_v1", {
          p_pack_id: pack_id,
          p_source_id: source_id,
          p_actor_user_id: user.id
        });
        if (error) throw error;
        result = data;
      } catch (err: any) {
        status = "failed";
        errorMsg = err.message;
      }
    }

    // 5. Log Audit Event
    await supabase.from("lifecycle_audit_events").insert({
      pack_id,
      actor_user_id: user.id,
      action: "purge_source",
      target_type: "source",
      target_id: source_id,
      parameters: { mode, source_type: source.type },
      rows_deleted: result,
      status,
      error_message: errorMsg
    });

    if (status === "failed") throw new Error(errorMsg || "Purge execution failed");

    return new Response(JSON.stringify({ 
      success: true,
      mode,
      counts: result,
      message: mode === "dry_run" ? "Dry run successful. Ready for purge." : "Source purged successfully."
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: err.message === "Unauthorized" || err.message.includes("permissions") ? 401 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
