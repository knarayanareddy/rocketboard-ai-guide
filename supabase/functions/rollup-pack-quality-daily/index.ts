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
    const authHeader = req.headers.get("Authorization");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cronToken = Deno.env.get("CRON_AUTH_TOKEN");

    // Auth check: service_role or CRON_AUTH_TOKEN
    const isAuthorized = 
      authHeader === `Bearer ${serviceKey}` || 
      (cronToken && authHeader === `Bearer ${cronToken}`);

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { 
        status: 401, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      serviceKey ?? ""
    );

    const { pack_id, day_from, day_to, dry_run = false } = await req.json().catch(() => ({}));

    // Default range: yesterday and today
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);

    const from = day_from || yesterday.toISOString().split("T")[0];
    const to = day_to || now.toISOString().split("T")[0];

    console.log(`[rollup-v1] Aggregating from ${from} to ${to} ${pack_id ? `for pack ${pack_id}` : 'for all packs'}`);

    if (dry_run) {
      // In dry_run, we just select the aggregates to log them
      const { data, error } = await supabase
        .from("rag_metrics")
        .select(`
          pack_id,
          created_at.date(),
          count(*)
        `)
        .gte("created_at", from)
        .lte("created_at", to + "T23:59:59");
      
      return new Response(JSON.stringify({ dry_run: true, data, error }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Perform idempotent rollup via RPC
    const { error } = await supabase.rpc("rollup_pack_quality_aggregates", {
      p_day_from: from,
      p_day_to: to
    });

    if (error) {
      console.error("[rollup-v1] RPC Error:", error);
      throw error;
    }

    return new Response(JSON.stringify({ 
      success: true, 
      range: { from, to },
      processed_at: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[rollup-v1] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
