// @ts-nocheck
// Stepwise Controller: creates job + state, fetches file tree, invokes worker
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
import { getSourceCredential } from "../_shared/credentials.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requireUser } from "../_shared/authz.ts";
import { requirePackRole } from "../_shared/pack-access.ts";
import { createTrace, shouldTrace } from "../_shared/telemetry.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";

const ALLOWED_ORIGINS = parseAllowedOrigins();

const SUPPORTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".md", ".json", ".yaml", ".yml", ".toml",
  ".py", ".go", ".rs", ".java", ".rb", ".sh", ".bash", ".css", ".scss",
  ".html", ".sql", ".graphql", ".gql", ".tf",
]);

const SUPPORTED_FILENAMES = new Set([
  "Dockerfile", "Makefile", ".env.example", ".env.sample",
  "docker-compose.yml", "docker-compose.yaml", "Jenkinsfile", "README.md",
  "README", "CONTRIBUTING.md", "SETUP.md",
]);

function isSupported(filepath: string): boolean {
  const basename = filepath.split("/").pop() || "";
  if (SUPPORTED_FILENAMES.has(basename)) return true;
  if (basename.startsWith("README") || basename.startsWith("CONTRIBUTING") || basename.startsWith("SETUP")) return true;
  const ext = "." + basename.split(".").pop();
  return SUPPORTED_EXTENSIONS.has(ext);
}

async function fetchGitHubTree(owner: string, repo: string, token?: string): Promise<string[]> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `token ${token}`;
  const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
  const resp = await fetch(url, { headers });
  if (!resp.ok) {
    if (resp.status === 403) throw new Error("GitHub Rate Limit");
    throw new Error(`GitHub Error: ${resp.status}`);
  }
  const data = await resp.json();
  return (data.tree || []).filter((item: any) => item.type === "blob" && isSupported(item.path)).map((item: any) => item.path);
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

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  try {
    const body = await readJson(req, corsHeaders);
    const { pack_id, source_id, source_type, source_uri, document_content, label, source_config, module_key, track_key } = body;

    const { userId } = await requireUser(req, corsHeaders);
    const serviceClient = createServiceClient();
    await requirePackRole(serviceClient, pack_id, userId, "author", corsHeaders);

    // Resolve org_id
    const { data: packRow, error: packErr } = await serviceClient
      .from("packs")
      .select("org_id")
      .eq("id", pack_id)
      .single();

    if (packErr || !packRow?.org_id) {
      return jsonError(400, "org_id_lookup_failed", `Failed to resolve organization: ${packErr?.message || "Missing org_id"}`, {}, corsHeaders);
    }
    const org_id = packRow.org_id;

    // Create ingestion job
    const { data: job, error: jobErr } = await serviceClient
      .from("ingestion_jobs")
      .insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString(), phase: "init" })
      .select("id")
      .single();
    if (jobErr) throw jobErr;
    const jobId = job.id;

    const trace = createTrace({
      serviceName: "ingest-source",
      taskType: "ingestion",
      requestId: crypto.randomUUID(),
      packId: pack_id,
      sourceId: source_id,
      orgId: org_id,
      environment: Deno.env.get("ENVIRONMENT") || "production",
    }, { enabled: shouldTrace() });
    trace.updateMetadata({ jobId });

    if (source_type === "github_repo") {
      // Validate URL
      const validatedUri = parseAndValidateExternalUrl(source_uri!, { allowedHosts: ["github.com"], disallowPrivateIPs: true, allowHttps: true });
      const match = validatedUri.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error("Invalid GitHub repo URL");
      const [, owner, repoRaw] = match;
      const repo = repoRaw.replace(/\.git$/, "");

      const githubToken = await getSourceCredential(serviceClient, source_id, "api_token") || Deno.env.get("GITHUB_TOKEN");

      // Fetch tree (lightweight — just file paths)
      await serviceClient.from("ingestion_jobs").update({ phase: "fetch_tree" }).eq("id", jobId);
      const files = await fetchGitHubTree(owner, repo, githubToken);

      await serviceClient.from("ingestion_jobs").update({ total_chunks: files.length }).eq("id", jobId);

      // Create job state with file tree
      await serviceClient.from("ingestion_job_state").insert({
        job_id: jobId,
        file_tree: files,
        cursor: 0,
        symbol_cursor: 0,
        invocations_count: 0,
        phase: "processing",
      });

      // Invoke first worker batch
      const { origin } = new URL(req.url);
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${origin}/functions/v1/ingest-source-worker`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ job_id: jobId, pack_id, source_id, owner, repo, token: githubToken, module_key, track_key }),
      }).catch(e => console.error("[CONTROLLER] Failed to invoke worker:", e));

      console.log(`[CONTROLLER] Scheduled stepwise ingestion for ${files.length} files, job ${jobId}`);
    } else if (source_type === "document") {
      // Document ingestion is small enough to do inline
      await serviceClient.from("ingestion_jobs").update({ phase: "chunking" }).eq("id", jobId);
      const chunks = chunkWords(document_content || "");
      const docChunks = chunks.map((c, i) => {
        const assessment = assessChunkRedaction(c.text);
        return {
          pack_id, source_id, chunk_id: `C${String(i + 1).padStart(5, "0")}`,
          path: `doc:${label || "untitled"}`, start_line: c.start, end_line: c.end,
          content: assessment.contentToStore, content_hash: "hash_placeholder", is_redacted: assessment.isRedacted,
          metadata: { ingestion_job_id: jobId, generation_id: jobId, module_key, track_key }
        };
      });
      await serviceClient.from("knowledge_chunks").upsert(docChunks);

      // Finalize
      await serviceClient.from("pack_active_generation").upsert(
        { org_id, pack_id, active_generation_id: jobId, updated_at: new Date().toISOString() },
        { onConflict: "org_id,pack_id" }
      );
      await serviceClient.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);
      await serviceClient.from("ingestion_jobs").update({
        status: "completed", phase: "completed", completed_at: new Date().toISOString(),
      }).eq("id", jobId);
    }

    return json(202, { success: true, job_id: jobId }, corsHeaders);
  } catch (err: any) {
    console.error("[CONTROLLER] Error:", err);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
