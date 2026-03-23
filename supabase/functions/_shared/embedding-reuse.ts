import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Fetches existing embeddings for a set of content hashes within the same pack and source.
 * This is used by ingestion connectors to avoid regenerating embeddings for unchanged files.
 */
export async function getExistingEmbeddings(
  supabase: SupabaseClient,
  pack_id: string,
  source_id: string,
  hashes: string[]
): Promise<Map<string, number[]>> {
  if (!hashes.length) return new Map();

  const resultMap = new Map<string, number[]>();

  // Fetch from the same source to ensure consistency
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("content_hash, embedding")
    .eq("pack_id", pack_id)
    .eq("source_id", source_id)
    .in("content_hash", hashes)
    .not("embedding", "is", null)
    .eq("is_redacted", false);

  if (error) {
    console.error("[REUSE] Error fetching existing embeddings:", error);
    return resultMap;
  }

  for (const row of (data || [])) {
    // pgvector returns a string like "[0.1,0.2,...]" or already parsed array
    const embedding = typeof row.embedding === "string" 
      ? JSON.parse(row.embedding) 
      : row.embedding;
    resultMap.set(row.content_hash, embedding);
  }

  return resultMap;
}

/**
 * Fetches existing embeddings from the current active generation of a pack.
 * This is used by reindex-orgs to reuse embeddings across reindexing cycles.
 */
export async function getPreviousGenerationEmbeddings(
  supabase: SupabaseClient,
  pack_id: string,
  hashes: string[]
): Promise<Map<string, number[]>> {
  if (!hashes.length) return new Map();

  const resultMap = new Map<string, number[]>();

  // 1. Find the active generation ID
  const { data: activeGen, error: genErr } = await supabase
    .from("pack_active_generation")
    .select("active_generation_id")
    .eq("pack_id", pack_id)
    .single();

  if (genErr || !activeGen?.active_generation_id) {
    return resultMap;
  }

  // 2. Fetch embeddings from that generation
  const { data, error } = await supabase
    .from("knowledge_chunks")
    .select("content_hash, embedding")
    .eq("pack_id", pack_id)
    .eq("generation_id", activeGen.active_generation_id)
    .in("content_hash", hashes)
    .not("embedding", "is", null)
    .eq("is_redacted", false);

  if (error) {
    console.error("[REUSE] Error fetching prev generation embeddings:", error);
    return resultMap;
  }

  for (const row of (data || [])) {
    const embedding = typeof row.embedding === "string" 
      ? JSON.parse(row.embedding) 
      : row.embedding;
    resultMap.set(row.content_hash, embedding);
  }

  return resultMap;
}

/**
 * Generates an embedding for the given text. Supports OpenAI and Lovable Gateway.
 */
export async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  if (!apiKey) return null;
  
  const openAIApiKey = Deno.env.get("OPENAI_API_KEY");
  const useLovableGateway = !openAIApiKey && !!Deno.env.get("LOVABLE_API_KEY");
  
  try {
    const url = useLovableGateway
      ? "https://ai.gateway.lovable.dev/v1/embeddings"
      : "https://api.openai.com/v1/embeddings";

    const res = await fetch(url, {
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
      console.error(`[EMBEDDING] Error from ${url}:`, await res.text());
      return null;
    }
    
    const data = await res.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error("[EMBEDDING] Generation error:", err);
    return null;
  }
}

import { updateHeartbeat } from "./ingestion-guards.ts";

/**
 * Processes a batch of chunks: attempts reuse then generates missing embeddings.
 * Updates chunks in-place.
 */
export async function processEmbeddingsWithReuse(
  supabase: SupabaseClient,
  pack_id: string,
  source_id: string,
  chunks: any[],
  openAIApiKey: string,
  jobId?: string
): Promise<{ reusedCount: number; generatedCount: number }> {
  const indexableChunks = chunks.filter(c => !c.is_redacted);
  let reusedCount = 0;
  let generatedCount = 0;

  if (indexableChunks.length > 0) {
    const hashes = indexableChunks.map(c => c.content_hash);
    const existingEmbeddings = await getExistingEmbeddings(supabase, pack_id, source_id, hashes);
    
    for (const chunk of indexableChunks) {
      const reused = existingEmbeddings.get(chunk.content_hash);
      if (reused) {
        chunk.embedding = reused;
        reusedCount++;
      }
    }

    if (openAIApiKey) {
      const remainingToIndex = indexableChunks.filter(c => !c.embedding);
      if (remainingToIndex.length > 0) {
        // Parallelize embedding generation in batches to avoid overwhelming the gateway/API
        const EMBEDDING_BATCH_SIZE = 5;
        for (let i = 0; i < remainingToIndex.length; i += EMBEDDING_BATCH_SIZE) {
          const batch = remainingToIndex.slice(i, i + EMBEDDING_BATCH_SIZE);
          await Promise.all(
            batch.map(async (chunk) => {
              const vector = await generateEmbedding(chunk.content, openAIApiKey);
              if (vector) {
                chunk.embedding = vector;
                generatedCount++;
              }
            })
          );

          // Heartbeat every few batches during the slow embedding phase
          if (jobId && (i / EMBEDDING_BATCH_SIZE) % 5 === 0) {
            await updateHeartbeat(supabase, jobId);
          }
        }
      }
    }
  }

  return { reusedCount, generatedCount };
}
