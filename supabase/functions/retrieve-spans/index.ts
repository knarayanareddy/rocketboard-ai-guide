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

    // Resolve org_id from memberhip
    const { data: memberData } = await adminClient
      .from("org_members")
      .select("org_id")
      .eq("user_id", user.id)
      .limit(1)
      .single();
    
    const org_id = memberData?.org_id;
    if (!org_id) {
       return new Response(JSON.stringify({ error: "No organization found for user" }), {
        status: 403, headers: corsHeaders,
      });
    }

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

    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("LOVABLE_API_KEY") || "";
    let embedding = null;

    if (openAIApiKey) {
      embedding = await generateEmbedding(query, openAIApiKey);
    }

    if (!embedding) {
       return new Response(JSON.stringify({ error: "Failed to generate query embedding" }), {
        status: 500, headers: corsHeaders,
      });
    }

    console.log(`[RETRIEVAL] Using hybrid_search_v2 for pack ${pack_id}, org ${org_id}`);
    
    const { data: chunks, error: rpcError } = await adminClient.rpc('hybrid_search_v2', {
      p_org_id: org_id,
      p_pack_id: pack_id,
      p_query_text: tsQuery,
      p_query_embedding: embedding,
      p_match_count: max_spans,
    });

    if (rpcError) {
      console.error("Hybrid Search error:", rpcError);
      return new Response(JSON.stringify({ error: "Hybrid search failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const spans = (chunks || []).map((chunk: any, idx: number) => ({
      span_id: `S${idx + 1}`,
      path: chunk.path,
      chunk_id: chunk.id,
      start_line: chunk.line_start,
      end_line: chunk.line_end,
      text: chunk.content,
      metadata: {
        entity_type: chunk.entity_type,
        entity_name: chunk.entity_name,
        signature: chunk.signature
      }
    }));

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
