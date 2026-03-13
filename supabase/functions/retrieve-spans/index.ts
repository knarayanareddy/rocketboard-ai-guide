import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pack_id, query, max_spans = 10, module_key, track_key } = await req.json();

    if (!pack_id || !query) {
      return new Response(JSON.stringify({ error: "Missing pack_id or query" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    // Verify user via getClaims
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: corsHeaders,
      });
    }

    // Use service role for the actual query (since knowledge_chunks RLS is pack-member based)
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Build tsquery from the user's query
    const tsQuery = query
      .trim()
      .split(/\s+/)
      .filter((w: string) => w.length > 1)
      .map((w: string) => w.replace(/[^a-zA-Z0-9]/g, ""))
      .filter(Boolean)
      .join(" | ");

    if (!tsQuery) {
      return new Response(JSON.stringify({ spans: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build path filter if module_key or track_key provided
    let pathFilter = null;
    if (module_key) pathFilter = `%${module_key}%`;
    if (track_key) pathFilter = `%${track_key}%`;

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("LOVABLE_API_KEY") || "";
    let embedding = null;
    
    if (openAIApiKey) {
      embedding = await generateEmbedding(query, openAIApiKey);
    }

    let spans = [];

    if (embedding) {
      console.log(`[RETRIEVAL] Using hybrid search for pack ${pack_id}`);
      
      const { data: chunks, error: rpcError } = await adminClient.rpc('match_chunks_hybrid', {
        query_embedding: embedding,
        query_text: tsQuery,
        match_count: max_spans,
        target_pack_id: pack_id,
        path_filter: pathFilter
      });

      if (rpcError) {
        console.error("Hybrid Search error:", rpcError);
        return new Response(JSON.stringify({ error: "Hybrid search failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      spans = (chunks || []).map((chunk: any, idx: number) => ({
        span_id: `S${idx + 1}`,
        path: chunk.path,
        chunk_id: chunk.chunk_id,
        start_line: chunk.start_line,
        end_line: chunk.end_line,
        text: chunk.content,
      }));
    } else {
      console.log(`[RETRIEVAL] Fallback to FTS for pack ${pack_id}`);
      
      // Fetch source weights for this pack
      const { data: sourceWeights } = await adminClient
        .from("pack_sources")
        .select("id, weight")
        .eq("pack_id", pack_id);

      const weightMap = new Map((sourceWeights ?? []).map((s: any) => [s.id, Number(s.weight) || 1.0]));

      let queryBuilder = adminClient
        .from("knowledge_chunks")
        .select("id, chunk_id, path, start_line, end_line, content, metadata, source_id")
        .eq("pack_id", pack_id)
        .eq("is_redacted", false)
        .textSearch("fts", tsQuery, { type: "plain" })
        .limit(max_spans * 2); // Fetch more for re-ranking

      if (pathFilter) {
        queryBuilder = queryBuilder.ilike("path", pathFilter);
      }

      const { data: chunks, error: queryError } = await queryBuilder;

      if (queryError) {
        console.error("Search error:", queryError);
        return new Response(JSON.stringify({ error: "Search failed" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Re-rank based on source weight
      spans = (chunks || [])
        .map((chunk: any) => ({
          ...chunk,
          weight: weightMap.get(chunk.source_id) || 1.0
        }))
        // Simple re-ranking: sort by weight descending
        .sort((a, b) => b.weight - a.weight)
        .slice(0, max_spans)
        .map((chunk: any, idx: number) => ({
          span_id: `S${idx + 1}`,
          path: chunk.path,
          chunk_id: chunk.chunk_id,
          start_line: chunk.start_line,
          end_line: chunk.end_line,
          text: chunk.content,
        }));
    }

    return new Response(JSON.stringify({ spans }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Retrieve spans error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
