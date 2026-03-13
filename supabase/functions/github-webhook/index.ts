import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // GitHub sends events as POST
    const event = req.headers.get("x-github-event");
    if (event !== "push") {
      return new Response(JSON.stringify({ message: "Ignored event" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const payload = await req.json();
    const repoUrl = payload.repository?.html_url;

    if (!repoUrl) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find all packs that use this repository as a source
    const { data: sources, error: sErr } = await supabase
      .from("pack_sources")
      .select("pack_id")
      .ilike("source_uri", `%${repoUrl}%`);

    if (sErr) throw sErr;

    const packIds = [...new Set((sources || []).map(s => s.pack_id))];
    console.log(`[WEBHOOK] Push to ${repoUrl} affects ${packIds.length} pack(s)`);

    // Trigger staleness check for each affected pack
    for (const packId of packIds) {
      await fetch(`${supabaseUrl}/functions/v1/check-staleness`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ pack_id: packId }),
      });
      console.log(`[WEBHOOK] Triggered staleness check for pack ${packId}`);
    }

    return new Response(JSON.stringify({ success: true, affected_packs: packIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
