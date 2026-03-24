import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { readJson } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGINS")?.split(",")[0] || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function hexToUint8Array(hex: string): Uint8Array {
  const view = new Uint8Array(hex.length / 2);
  for (let i = 0; i < view.length; i++) {
    view[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return view;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // GitHub sends events as POST
    const signature = req.headers.get("x-hub-signature-256");
    const event = req.headers.get("x-github-event");
    
    if (event !== "push") {
      return new Response(JSON.stringify({ message: "Ignored event" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 1. Verify Signature
    const webhookSecret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.warn("[WEBHOOK WARNING] GITHUB_WEBHOOK_SECRET not set, bypassing signature check (INSECURE)");
    } else if (!signature) {
      console.error("[WEBHOOK ERROR] Missing x-hub-signature-256 header");
      return new Response(JSON.stringify({ error: "Missing signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else {
      const bodyText = await req.text();
      const hmac = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"]
      );
      const isVerified = await crypto.subtle.verify(
        "HMAC",
        hmac,
        hexToUint8Array(signature.replace("sha256=", "")).buffer,
        new TextEncoder().encode(bodyText)
      );

      if (!isVerified) {
        console.error("[WEBHOOK ERROR] Invalid HMAC signature");
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      
      var payload = JSON.parse(bodyText);
    }

    if (typeof payload === 'undefined') {
       payload = await readJson(req, corsHeaders);
    }
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

    const commits = payload.commits || [];
    const changedFiles = new Set<string>();
    commits.forEach((c: any) => {
      (c.added || []).forEach((f: string) => changedFiles.add(f));
      (c.modified || []).forEach((f: string) => changedFiles.add(f));
      (c.removed || []).forEach((f: string) => changedFiles.add(f));
    });
    const changedFilesList = Array.from(changedFiles);
    const compareUrl = payload.compare;

    // Trigger staleness check and remediation for each affected pack
    for (const packId of packIds) {
      // 1. Mark as stale
      await fetch(`${supabaseUrl}/functions/v1/check-staleness`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ pack_id: packId }),
      });
      console.log(`[WEBHOOK] Triggered staleness check for pack ${packId}`);

      // 2. Trigger async remediation drafting
      if (changedFilesList.length > 0 && compareUrl) {
        await fetch(`${supabaseUrl}/functions/v1/auto-remediate-module`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ pack_id: packId, changed_files: changedFilesList, compare_url: compareUrl }),
        });
        console.log(`[WEBHOOK] Triggered auto-remediation for pack ${packId}`);
      }
    }

    return new Response(JSON.stringify({ success: true, affected_packs: packIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
