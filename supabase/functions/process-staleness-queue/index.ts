import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGINS")?.split(",")[0] || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const expectedToken = Deno.env.get("CRON_AUTH_TOKEN");
    
    // Auth Validation: Ensure CRON_AUTH_TOKEN is provided if it exists in env, OR verify Service Role fallback if caller is internal. 
    // Usually CRON pushes Bearer <TOKEN>.
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.warn("process-staleness-queue: Unauthorized access attempt");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // We use the service_role key to bypass RLS and read the queue table.
    const serviceClient = createClient(supabaseUrl, serviceKey);

    console.log("process-staleness-queue: Checking for pending tasks...");

    // 1. Fetch up to 20 pending items. 
    // We only fetch the IDs first to lock them reliably.
    const { data: pendingRows, error: fetchErr } = await serviceClient
      .from("staleness_check_queue")
      .select("id, pack_id")
      .eq("status", "pending")
      .order("requested_at", { ascending: true })
      .limit(20);

    if (fetchErr) throw fetchErr;

    if (!pendingRows || pendingRows.length === 0) {
      console.log("process-staleness-queue: No pending tasks found.");
      return new Response(JSON.stringify({ message: "No pending tasks", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];

    // 2. Iterate and process
    for (const row of pendingRows) {
      // Optimistic lock: attempt to transition from 'pending' to 'processing'
      const { data: updated, error: updateErr } = await serviceClient
        .from("staleness_check_queue")
        .update({ status: "processing" })
        .eq("id", row.id)
        .eq("status", "pending")
        .select()
        .single();
      
      if (updateErr || !updated) {
         // Either another worker grabbed it or it's no longer pending.
         console.log(`process-staleness-queue: Task ${row.id} already picked up. Skipping.`);
         continue; 
      }

      console.log(`process-staleness-queue: Processing pack_id: ${row.pack_id}`);

      let errorMessage = null;
      let finalStatus = "done";

      try {
        // Enforce Per-pack serialization safely. The DB effectively enforces 1 pending per pack right now.
        // But what if one is already 'processing' for this pack? 
        // We can do a quick check if there's any OTHER processing task for this pack. 
        // If so, we can fail or requeue.
        const { data: activeOthers } = await serviceClient
            .from("staleness_check_queue")
            .select("id")
            .eq("pack_id", row.pack_id)
            .eq("status", "processing")
            .neq("id", row.id)
            .limit(1);
        
        if (activeOthers && activeOthers.length > 0) {
            throw new Error("Another staleness task is actively processing for this pack. Skipping to avoid collision.");
        }

        // Invoke existing check-staleness edge function over internal HTTP / invoke.
        const { data: funcData, error: funcErr } = await serviceClient.functions.invoke('check-staleness', {
          body: { pack_id: row.pack_id }
        });

        if (funcErr) {
            throw funcErr;
        }

        console.log(`process-staleness-queue: Successfully checked staleness for pack_id: ${row.pack_id}. Results:`, funcData);
      } catch (checkErr: any) {
        console.error(`process-staleness-queue: Error processing pack ${row.pack_id}:`, checkErr.message);
        errorMessage = checkErr.message;
        finalStatus = "failed";
      }

      // Finalize status
      await serviceClient.from("staleness_check_queue").update({
        status: finalStatus,
        error_message: errorMessage,
        processed_at: new Date().toISOString()
      }).eq("id", row.id);

      // Audit Record
      await serviceClient.from("lifecycle_audit_events").insert({
        pack_id: row.pack_id,
        action: "staleness_queue_processed",
        actor_id: null,
        details: { status: finalStatus, error_message: errorMessage, queue_id: row.id }
      });

      results.push({ id: row.id, pack_id: row.pack_id, status: finalStatus });
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("process-staleness-queue: Uncaught error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
