import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { storeSourceCredential } from "../_shared/credentials.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Edge Function to securely configure or update a source.
 * This function separates sensitive credentials from public metadata.
 * Meta-data is stored in pack_sources.source_config, while credentials
 * are moved to Supabase Vault via store_source_credential.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      pack_id, 
      source_id, 
      source_type, 
      source_uri, 
      label, 
      source_config,
      credentials 
    } = await req.json();

    if (!pack_id || !source_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let targetSourceId = source_id;

    // 1. Upsert the pack_source record (without credentials)
    const sourceData = {
      pack_id,
      source_type,
      source_uri,
      label,
      source_config: source_config || {},
    };

    if (targetSourceId) {
      const { error: updateErr } = await supabase
        .from("pack_sources")
        .update(sourceData)
        .eq("id", targetSourceId);
      if (updateErr) throw updateErr;
    } else {
      const { data: newSource, error: insertErr } = await supabase
        .from("pack_sources")
        .insert(sourceData)
        .select()
        .single();
      if (insertErr) throw insertErr;
      targetSourceId = newSource.id;
    }

    // 2. Store credentials in Vault if provided
    if (credentials && typeof credentials === 'object') {
      for (const [type, value] of Object.entries(credentials)) {
        if (value && typeof value === 'string') {
          console.log(`[CONFIGURE-SOURCE] Storing credential ${type} for source ${targetSourceId}`);
          await storeSourceCredential(
            supabase,
            targetSourceId,
            value,
            type,
            `${source_type} ${type} (secure)`
          );
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      source_id: targetSourceId 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[CONFIGURE-SOURCE] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
