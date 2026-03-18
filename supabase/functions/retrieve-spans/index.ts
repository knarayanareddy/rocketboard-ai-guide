import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createTrace } from "../_shared/telemetry.ts";

const ALLOWED_ORIGINS_ENV = Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:5173,http://localhost:8080";
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_ENV.split(",").map(o => o.trim());

function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin", // SECURITY: Ensure CDNs don't cache headers for wrong origin
  };
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  
  return headers;
}

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: text.replace(/\n/g, " "),
        model: "text-embedding-3-small"
      })
    });
    if (!res.ok) {
      console.error("OpenAI Embedding error:", await res.text());
      return null;
    }
    const data = await res.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error("Embedding generation failed:", err);
    return null;
  }
}

Deno.serve(async (req) => {
  const startTime = Date.now();
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let trace = createTrace({ taskType: "startup", requestId: "unknown" }, { enabled: false });
  let requestId = "unknown";
  try {
    const body = await req.json();
    const { pack_id, query, max_spans = 10, module_key, track_key } = body;

    // ─── Phase 6: Observability — create trace ── Correlate with router requestId
    trace = createTrace({
      taskType: "retrieve-spans",
      requestId,
      packId: pack_id,
      serviceName: "retrieval",
    });

    if (!pack_id || !query || typeof query !== "string") {
      return new Response(JSON.stringify({ error: "Missing pack_id or valid query" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Defensive Caps
    const clampedQuery = query.trim().slice(0, 500);
    const clampedMaxSpans = Math.min(Math.max(Number(max_spans) || 10, 1), 50);

    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Verify user and get org_id
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    // Use service role for the actual query (since knowledge_chunks RLS is pack-member based)
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // 1. Resolve org_id and verify pack exists
    const { data: packData, error: packError } = await adminClient
      .from("packs")
      .select("org_id")
      .eq("id", pack_id)
      .maybeSingle();

    if (packError || !packData) {
      return new Response(JSON.stringify({ error: "Pack not found" }), {
        status: 404, headers: corsHeaders,
      });
    }

    const org_id = packData.org_id;

    // 2. Security Check: Verify user belongs to the pack (or has access)
    // We use service role to check membership accurately regardless of user's current JWT claims
    const { data: membership, error: memberError } = await adminClient
      .from("pack_members")
      .select("role")
      .eq("pack_id", pack_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !membership) {
      console.warn(`[RETRIEVAL] Access denied for user ${user.id} to pack ${pack_id}`);
      return new Response(JSON.stringify({ error: "Forbidden: You are not a member of this pack" }), {
        status: 403, headers: corsHeaders,
      });
    }

    if (clampedQuery.length === 0) {
      return new Response(JSON.stringify({ spans: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("LOVABLE_API_KEY") || "";
    let embedding = null;

    if (openAIApiKey) {
      const embedSpan = trace.startSpan("generate-embedding");
      embedding = await generateEmbedding(clampedQuery, openAIApiKey);
      embedSpan.end({ success: !!embedding });
    }

    // Reliability: Fallback to keyword-only search if embedding fails
    if (!embedding) {
      console.warn("[RETRIEVAL] Embedding generation failed, falling back to keyword search.");
    }

    console.log(`[RETRIEVAL] Using hybrid_search_v2 for pack ${pack_id}, org ${org_id}. Context: ${module_key || 'global'}`);
    
    const rpcSpan = trace.startSpan("rpc:hybrid_search_v2");
    const { data: chunks, error: rpcError } = await adminClient.rpc('hybrid_search_v2', {
      p_org_id: org_id,
      p_pack_id: pack_id,
      p_query_text: clampedQuery,
      p_query_embedding: embedding,
      p_match_count: clampedMaxSpans,
      p_module_key: module_key || null,
      p_track_key: track_key || null
    });
    rpcSpan.end({ count: chunks?.length || 0, error: !!rpcError });

    if (rpcError) {
      console.error("Hybrid Search error:", rpcError);
      return new Response(JSON.stringify({ error: "Hybrid search failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const spans = (chunks || []).map((chunk: any, idx: number) => ({
      span_id: `S${idx + 1}`,
      path: chunk.path,
      chunk_id: chunk.chunk_id || chunk.id,
      start_line: chunk.line_start,
      end_line: chunk.line_end,
      text: chunk.content,
      metadata: {
        entity_type: chunk.entity_type,
        entity_name: chunk.entity_name,
        signature: chunk.signature
      }
    }));

    const latency_ms = Date.now() - startTime;
    await trace.flush();

    return new Response(JSON.stringify({ 
      spans, 
      trace_id: requestId,
      latency_ms 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const latency_ms = Date.now() - startTime;
    trace.setError(err.message);
    await trace.flush();
    return new Response(JSON.stringify({ error: (err as Error).message, trace_id: requestId, latency_ms }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
