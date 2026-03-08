import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Secret redaction patterns
const REDACTION_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g, // AWS Access Key
  /(?:aws_secret_access_key|secret_key)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi,
  /(?:Bearer\s+)[A-Za-z0-9\-._~+/]+=*/g,
  /eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/g, // JWT
  /(?:password|passwd|pwd|secret|token|api_key|apikey|api-key)\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/gi,
  /(?:mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi, // Connection strings
  /ghp_[A-Za-z0-9]{36}/g, // GitHub PAT
  /sk-[A-Za-z0-9]{32,}/g, // OpenAI-style keys
  /xox[bprs]-[A-Za-z0-9\-]+/g, // Slack tokens
];

const SUPPORTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".md", ".json", ".yaml", ".yml",
  ".toml", ".py", ".go", ".rs", ".java", ".rb", ".sh", ".bash",
  ".css", ".scss", ".html", ".sql", ".graphql", ".gql",
]);

const SUPPORTED_FILENAMES = new Set([
  "Dockerfile", "Makefile", ".env.example", ".env.sample",
  "docker-compose.yml", "docker-compose.yaml",
]);

function isSupported(filepath: string): boolean {
  const basename = filepath.split("/").pop() || "";
  if (SUPPORTED_FILENAMES.has(basename)) return true;
  const ext = "." + basename.split(".").pop();
  return SUPPORTED_EXTENSIONS.has(ext);
}

function redactSecrets(text: string): { content: string; isRedacted: boolean } {
  let redacted = text;
  let wasRedacted = false;
  for (const pattern of REDACTION_PATTERNS) {
    const newText = redacted.replace(pattern, "***REDACTED***");
    if (newText !== redacted) wasRedacted = true;
    redacted = newText;
  }
  return { content: redacted, isRedacted: wasRedacted };
}

function chunkLines(lines: string[], chunkSize = 120, overlap = 10): { start: number; end: number; text: string }[] {
  const chunks: { start: number; end: number; text: string }[] = [];
  let i = 0;
  while (i < lines.length) {
    const end = Math.min(i + chunkSize, lines.length);
    chunks.push({
      start: i + 1,
      end,
      text: lines.slice(i, end).join("\n"),
    });
    i = end - overlap;
    if (i >= lines.length) break;
    if (end === lines.length) break;
  }
  return chunks;
}

function chunkWords(text: string, wordCount = 500): { start: number; end: number; text: string }[] {
  const words = text.split(/\s+/);
  const chunks: { start: number; end: number; text: string }[] = [];
  let i = 0;
  let lineEstimate = 1;
  while (i < words.length) {
    const end = Math.min(i + wordCount, words.length);
    const chunk = words.slice(i, end).join(" ");
    const lines = chunk.split("\n").length;
    chunks.push({ start: lineEstimate, end: lineEstimate + lines - 1, text: chunk });
    lineEstimate += lines;
    i = end;
  }
  return chunks;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function fetchGitHubTree(owner: string, repo: string, token?: string): Promise<string[]> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `token ${token}`;

  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub API error: ${resp.status} ${err}`);
  }
  const data = await resp.json();
  return (data.tree || [])
    .filter((item: any) => item.type === "blob" && isSupported(item.path))
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
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pack_id, source_id, source_type, source_uri, document_content, label } = await req.json();

    if (!pack_id || !source_id || !source_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Create ingestion job
    const { data: job, error: jobErr } = await supabase
      .from("ingestion_jobs")
      .insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString() })
      .select()
      .single();
    if (jobErr) throw jobErr;

    const jobId = job.id;
    let allChunks: { chunk_id: string; path: string; start_line: number; end_line: number; content: string; content_hash: string; is_redacted: boolean }[] = [];

    if (source_type === "github_repo") {
      // Parse GitHub URL
      const match = source_uri.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error("Invalid GitHub repo URL");
      const [, owner, repo] = match;

      const githubToken = Deno.env.get("GITHUB_TOKEN");
      const files = await fetchGitHubTree(owner, repo.replace(/\.git$/, ""), githubToken);

      await supabase.from("ingestion_jobs").update({ total_chunks: files.length * 2 }).eq("id", jobId);

      let chunkIdx = 0;
      for (const filepath of files) {
        const fileContent = await fetchGitHubFile(owner, repo.replace(/\.git$/, ""), filepath, githubToken);
        if (!fileContent) continue;

        const lines = fileContent.split("\n");
        const fileChunks = chunkLines(lines);

        for (const chunk of fileChunks) {
          chunkIdx++;
          const { content, isRedacted } = redactSecrets(chunk.text);
          const hash = await sha256(content);
          allChunks.push({
            chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
            path: `repo:${owner}/${repo.replace(/\.git$/, "")}/${filepath}`,
            start_line: chunk.start,
            end_line: chunk.end,
            content,
            content_hash: hash,
            is_redacted: isRedacted,
          });
        }

        // Update progress periodically
        if (allChunks.length % 50 === 0) {
          await supabase.from("ingestion_jobs").update({ processed_chunks: allChunks.length }).eq("id", jobId);
        }
      }
    } else if (source_type === "document") {
      const text = document_content || "";
      const docLabel = label || source_uri || "untitled";
      const chunks = chunkWords(text);

      let chunkIdx = 0;
      for (const chunk of chunks) {
        chunkIdx++;
        const { content, isRedacted } = redactSecrets(chunk.text);
        const hash = await sha256(content);
        allChunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `doc:${docLabel}`,
          start_line: chunk.start,
          end_line: chunk.end,
          content,
          content_hash: hash,
          is_redacted: isRedacted,
        });
      }
    } else {
      throw new Error(`Unsupported source_type: ${source_type}`);
    }

    // Update total
    await supabase.from("ingestion_jobs").update({ total_chunks: allChunks.length }).eq("id", jobId);

    // Upsert chunks in batches
    const BATCH_SIZE = 100;
    let processed = 0;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE).map((c) => ({
        pack_id,
        source_id,
        ...c,
      }));

      const { error: upsertErr } = await supabase
        .from("knowledge_chunks")
        .upsert(batch, { onConflict: "pack_id,chunk_id" });

      if (upsertErr) {
        console.error("Upsert error:", upsertErr);
      }

      processed += batch.length;
      await supabase.from("ingestion_jobs").update({ processed_chunks: processed }).eq("id", jobId);
    }

    // Update source last_synced_at
    await supabase.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);

    // Mark job completed
    await supabase.from("ingestion_jobs").update({
      status: "completed",
      processed_chunks: allChunks.length,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: allChunks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Ingestion error:", err);

    // Try to mark job as failed
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, serviceKey);
      // Can't update job without jobId in this catch, but log the error
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
