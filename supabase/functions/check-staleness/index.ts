import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader ?? "" } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { pack_id } = await req.json();
    if (!pack_id) {
      return new Response(JSON.stringify({ error: "pack_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const serviceClient = createClient(supabaseUrl, serviceKey);

    // Get all content_freshness rows for this pack
    const { data: freshnessRows, error: fErr } = await serviceClient
      .from("content_freshness")
      .select("*")
      .eq("pack_id", pack_id);

    if (fErr) throw fErr;
    if (!freshnessRows || freshnessRows.length === 0) {
      return new Response(JSON.stringify({ stale_count: 0, checked: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Collect all referenced chunk IDs
    const allChunkIds = new Set<string>();
    for (const row of freshnessRows) {
      for (const cid of (row.referenced_chunk_ids || [])) allChunkIds.add(cid);
    }

    // Fetch current hashes
    const { data: chunks } = await serviceClient
      .from("knowledge_chunks")
      .select("chunk_id, content_hash")
      .eq("pack_id", pack_id)
      .in("chunk_id", Array.from(allChunkIds));

    const currentHashes = new Map((chunks ?? []).map((c: any) => [c.chunk_id, c.content_hash]));

    let staleCount = 0;
    for (const row of freshnessRows) {
      const storedHashes = row.chunk_hash_at_generation || {};
      let isStale = false;
      const details: any[] = [];

      for (const cid of (row.referenced_chunk_ids || [])) {
        const currentHash = currentHashes.get(cid);
        const storedHash = (storedHashes as any)[cid];
        if (!currentHash) {
          isStale = true;
          details.push({ chunk_id: cid, reason: "deleted" });
        } else if (storedHash && currentHash !== storedHash) {
          isStale = true;
          details.push({ chunk_id: cid, reason: "modified" });
        }
      }

      if (isStale) staleCount++;

      await serviceClient.from("content_freshness").update({
        is_stale: isStale,
        staleness_details: { changed_chunks: details },
        last_checked_at: new Date().toISOString(),
      }).eq("id", row.id);
    }

    return new Response(JSON.stringify({ stale_count: staleCount, checked: freshnessRows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
