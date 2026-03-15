import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { astChunk } from "../_shared/ast-chunker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reuse helpers from ingest-source (ideally these move to _shared later)
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
    if (!res.ok) return null;
    const data = await res.json();
    return data.data[0].embedding;
  } catch (err) {
    return null;
  }
}

async function fetchGitHubTree(owner: string, repo: string, token?: string): Promise<string[]> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `token ${token}`;
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers });
  if (!resp.ok) throw new Error(`GitHub API error: ${resp.status}`);
  const data = await resp.json();
  const SUPPORTED_EXT = [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".md", ".json", ".yaml", ".yml"];
  return (data.tree || [])
    .filter((item: any) => item.type === "blob" && SUPPORTED_EXT.some(ext => item.path.endsWith(ext)))
    .map((item: any) => item.path);
}

async function fetchGitHubFile(owner: string, repo: string, path: string, token?: string): Promise<string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3.raw" };
  if (token) headers.Authorization = `token ${token}`;
  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
  if (!resp.ok) return "";
  return await resp.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { org_id, pack_id } = await req.json();
    if (!org_id || !pack_id) throw new Error("Missing org_id or pack_id");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const generation_id = crypto.randomUUID();

    // 1. Initialize Progress
    await supabase.from("reindex_progress").upsert({
      org_id,
      pack_id,
      status: "processing",
      started_at: new Date().toISOString()
    });

    // 2. Get all sources for the pack
    const { data: sources, error: sErr } = await supabase.from("pack_sources").select("*").eq("pack_id", pack_id);
    if (sErr) throw sErr;

    let totalFiles = 0;
    let processedFiles = 0;

    for (const source of sources) {
      if (source.source_type !== "github_repo") continue; // Simple MVP support
      
      const match = source.source_uri.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) continue;
      const [, owner, repo] = match;
      const repoName = repo.replace(/\.git$/, "");
      
      const files = await fetchGitHubTree(owner, repoName, githubToken);
      totalFiles += files.length;

      for (const filepath of files) {
        const content = await fetchGitHubFile(owner, repoName, filepath, githubToken);
        if (!content) continue;

        const chunks = await astChunk(content, filepath);
        const chunkBatch = [];

        for (const c of chunks) {
          const embedding = await generateEmbedding(c.text, openAIApiKey);
          chunkBatch.push({
            org_id,
            pack_id,
            source_id: source.id,
            chunk_id: `G-${generation_id.slice(0,8)}-${processedFiles}-${chunkBatch.length}`,
            path: filepath,
            content: c.text,
            entity_type: c.metadata.entity_type,
            entity_name: c.metadata.entity_name,
            signature: c.metadata.signature,
            line_start: c.metadata.line_start,
            line_end: c.metadata.line_end,
            generation_id,
            embedding,
            metadata: { imports: c.metadata.imports }
          });
        }

        if (chunkBatch.length > 0) {
          const { error: insErr } = await supabase.from("knowledge_chunks").insert(chunkBatch);
          if (insErr) console.error("[Reindex] Insert error:", insErr);
        }

        processedFiles++;
        await supabase.from("reindex_progress").update({
          chunks_processed: processedFiles,
          chunks_total: totalFiles
        }).eq("pack_id", pack_id).eq("org_id", org_id);
      }
    }

    // 3. Atomic Swap
    const { error: ledgerErr } = await supabase.from("pack_active_generation").upsert({
      org_id,
      pack_id,
      active_generation_id: generation_id,
      updated_at: new Date().toISOString()
    });
    if (ledgerErr) throw ledgerErr;

    // 4. Cleanup old chunks
    await supabase.from("knowledge_chunks")
      .delete()
      .eq("pack_id", pack_id)
      .neq("generation_id", generation_id);

    await supabase.from("reindex_progress").update({
      status: "completed",
      completed_at: new Date().toISOString()
    }).eq("pack_id", pack_id).eq("org_id", org_id);

    return new Response(JSON.stringify({ success: true, generation_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("[Reindex] Fatal:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
