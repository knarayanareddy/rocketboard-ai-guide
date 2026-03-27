// @ts-nocheck
// Modern Deno.serve is built-in, no import needed for server.ts
import { astChunk } from "../_shared/ast-chunker.ts";
import { getSourceCredential } from "../_shared/credentials.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
import {
  checkPackChunkCap,
  getRunCap,
  updateHeartbeat,
  validateIngestion,
} from "../_shared/ingestion-guards.ts";
import { computeContentHash } from "../_shared/hash-utils.ts";
import { processEmbeddingsWithReuse } from "../_shared/embedding-reuse.ts";
import { createTrace, shouldTrace } from "../_shared/telemetry.ts";
import { extractSymbols } from "../_shared/symbol-extractor.ts";

import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { requireUser } from "../_shared/authz.ts";
import { requirePackRole } from "../_shared/pack-access.ts";

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

const SETUP_PATTERNS: Record<string, RegExp[]> = {
  dependencies: [/^package\.json$/, /^requirements\.txt$/, /^Gemfile$/, /^go\.mod$/, /^Cargo\.toml$/, /^pom\.xml$/, /^build\.gradle$/],
  configuration: [/^\.env/, /^config\//, /\.config\.(js|ts|json|yaml|yml)$/, /settings\.(json|yaml|yml)$/],
  docker: [/^Dockerfile/, /^docker-compose/, /\.dockerfile$/i],
  ci_cd: [/^\.github\/workflows\//, /^\.gitlab-ci\.yml$/, /^Jenkinsfile$/, /^\.circleci\//, /^azure-pipelines\.yml$/],
  environment: [/^Makefile$/, /^scripts\//, /^bin\//, /^README/i, /^CONTRIBUTING/i, /^SETUP/i, /^INSTALL/i],
  infrastructure: [/^terraform\//, /^k8s\//, /^kubernetes\//, /^helm\//, /\.tf$/],
};

function getSetupMetadata(filepath: string): { is_setup_relevant: boolean; setup_category?: string } {
  const basename = filepath.split("/").pop() || "";
  for (const [category, patterns] of Object.entries(SETUP_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(filepath) || pattern.test(basename)) {
        return { is_setup_relevant: true, setup_category: category };
      }
    }
  }
  return { is_setup_relevant: false };
}

function isSupported(filepath: string): boolean {
  const basename = filepath.split("/").pop() || "";
  if (SUPPORTED_FILENAMES.has(basename)) return true;
  if (basename.startsWith("README") || basename.startsWith("CONTRIBUTING") || basename.startsWith("SETUP")) return true;
  const ext = "." + basename.split(".").pop();
  return SUPPORTED_EXTENSIONS.has(ext);
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

async function fetchGitHubFile(owner: string, repo: string, path: string, token?: string): Promise<string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3.raw" };
  if (token) headers.Authorization = `token ${token}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
  if (!res.ok) return "";
  return await res.text();
}

async function runIngestion(
  serviceClient: any,
  jobId: string,
  pack_id: string,
  source_id: string,
  source_type: string,
  source_uri: string | undefined,
  document_content: string | undefined,
  label: string | undefined,
  source_config: any,
  org_id: string | undefined,
  module_key: string | null,
  track_key: string | null,
  trace: any,
  functionUrl: string,
  startIndex = 0,
) {
  const jobStartMs = Date.now();
  const updatePhase = async (phase: string, extra?: Record<string, any>) => {
    await serviceClient.from("ingestion_jobs").update({
      phase,
      elapsed_ms: Date.now() - jobStartMs,
      ...extra,
    }).eq("id", jobId);
  };

  try {
    const controller = new AbortController();
    const abortSignal = controller.signal;

    if (source_type === "github_repo") {
      const validatedUri = parseAndValidateExternalUrl(source_uri!, { allowedHosts: ["github.com"], disallowPrivateIPs: true, allowHttps: true });
      const match = validatedUri.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error("Invalid GitHub repo URL");
      const [, owner, repo] = match;
      const repoName = repo.replace(/\.git$/, "");

      const githubToken = await getSourceCredential(serviceClient, source_id, "api_token") || Deno.env.get("GITHUB_TOKEN");

      let files: string[] = [];
      if (startIndex === 0) {
        await updatePhase("fetch_tree");
        files = await fetchGitHubTree(owner, repoName, githubToken);
        await serviceClient.from("ingestion_jobs").update({ total_chunks: files.length }).eq("id", jobId);
      } else {
        // Re-fetch tree on recursion (or pass it in body if under size limits, here we re-fetch for simplicity/safety)
        files = await fetchGitHubTree(owner, repoName, githubToken);
      }

      const BATCH_SIZE = 5; // Heavily reduced to stay under 2s CPU
      const batchFiles = files.slice(startIndex, startIndex + BATCH_SIZE);
      const isLastBatch = startIndex + BATCH_SIZE >= files.length;

      console.log(`[INGEST] Processing recursive batch: files ${startIndex} to ${startIndex + batchFiles.length} of ${files.length}`);

      await updateHeartbeat(serviceClient, jobId, { 
        phase: "fetch_files", 
        processed_chunks: startIndex,
        current_file_index: startIndex,
        elapsed_ms: Date.now() - jobStartMs 
      });

      let currentBatchChunks: any[] = [];
      for (let i = 0; i < batchFiles.length; i++) {
        const filepath = batchFiles[i];
        const globalIdx = startIndex + i;
        await updateHeartbeat(serviceClient, jobId, { phase: "fetch_files", current_file: filepath, current_file_index: globalIdx });
        
        const content = await fetchGitHubFile(owner, repoName, filepath, githubToken);
        if (!content) continue;

        await updatePhase("chunking", { current_file: filepath, current_file_index: globalIdx });
        const chunks = await astChunk(content, filepath, abortSignal);
        const setupMeta = getSetupMetadata(filepath);
        const sourceUrl = `https://github.com/${owner}/${repoName}/blob/main/${filepath}`;

        for (let j = 0; j < chunks.length; j++) {
          const chunk = chunks[j];
          const assessment = assessChunkRedaction(chunk.text);
          const hash = await computeContentHash(assessment.contentToStore);
          currentBatchChunks.push({
            pack_id, source_id,
            chunk_id: `C${String(globalIdx + 1).padStart(5, "0")}_${j}`,
            path: `repo:${owner}/${repoName}/${filepath}`,
            start_line: chunk.metadata.line_start,
            end_line: chunk.metadata.line_end,
            content: assessment.contentToStore,
            content_hash: hash,
            is_redacted: assessment.isRedacted,
            entity_type: chunk.metadata.entity_type,
            entity_name: chunk.metadata.entity_name,
            signature: chunk.metadata.signature,
            imports: chunk.metadata.imports,
            exported_names: chunk.metadata.exported_names || [],
            metadata: { 
              source_url: sourceUrl, ...setupMeta, 
              ingestion_job_id: jobId, generation_id: jobId,
              module_key, track_key
            },
          });
        }
      }

      if (currentBatchChunks.length > 0) {
        await updatePhase("upsert_chunks");
        const { error: upsertError } = await serviceClient.from("knowledge_chunks").upsert(currentBatchChunks);
        if (upsertError) throw upsertError;

        await updatePhase("build_symbol_graph");
        const definitions: any[] = [];
        const references: any[] = [];
        for (const chunk of currentBatchChunks) {
          if (chunk.is_redacted) continue;
          const symbols = new Set([chunk.entity_name, ...(chunk.exported_names || [])]);
          symbols.delete("anonymous"); symbols.delete("file_scope"); symbols.delete(undefined);
          for (const s of symbols) {
            definitions.push({ pack_id, source_id, symbol: s, chunk_id: chunk.chunk_id, path: chunk.path, line_start: chunk.start_line, line_end: chunk.end_line });
          }
          const refs = extractSymbols(chunk.content, chunk.path.split(".").pop() || "ts");
          for (const r of refs) {
            if (!symbols.has(r)) {
              references.push({ pack_id, source_id, symbol: r, from_chunk_id: chunk.chunk_id, from_path: chunk.path, from_line_start: chunk.start_line, from_line_end: chunk.end_line, confidence: 1.0 });
            }
          }
        }
        if (definitions.length > 0) await serviceClient.from("symbol_definitions").upsert(definitions);
        if (references.length > 0) await serviceClient.from("symbol_references").upsert(references);
      }

      if (!isLastBatch) {
        const nextIndex = startIndex + BATCH_SIZE;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        fetch(functionUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ pack_id, source_id, source_type, source_uri, document_content, label, source_config, module_key, track_key, startIndex: nextIndex, jobId }),
        }).catch(e => console.error("[RECURSE] failed:", e));
        return;
      }
    } else if (source_type === "document") {
      await updatePhase("chunking");
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
    }

    // FINALIZATION
    await updatePhase("atomic_swap");
    await serviceClient.from("pack_active_generation").upsert({ org_id, pack_id, active_generation_id: jobId, updated_at: new Date().toISOString() }, { onConflict: "org_id,pack_id" });
    await serviceClient.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);
    await updatePhase("completed");
    await updateHeartbeat(serviceClient, jobId, { status: "completed", completed_at: new Date().toISOString() });
  } catch (err: any) {
    console.error("Ingestion failed:", err);
    await serviceClient.from("ingestion_jobs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: err.message.slice(0, 500) }).eq("id", jobId);
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  try {
    const body = await readJson(req, corsHeaders);
    const { pack_id, source_id, source_type, source_uri, document_content, label, source_config, module_key, track_key, startIndex = 0, jobId: existingJobId } = body;

    const { userId } = await requireUser(req, corsHeaders);
    const serviceClient = createServiceClient();
    await requirePackRole(serviceClient, pack_id, userId, "author", corsHeaders);

    // Derive org_id from the database
    const { data: packRow, error: packErr } = await serviceClient
      .from("packs")
      .select("org_id")
      .eq("id", pack_id)
      .single();

    if (packErr || !packRow?.org_id) {
      console.error("[INGESTION] Failed to resolve org_id for pack", pack_id, packErr);
      return jsonError(
        400,
        "org_id_lookup_failed",
        `Failed to resolve organization for pack: ${packErr?.message || "Missing org_id"}`,
        {},
        corsHeaders,
      );
    }
    const effectiveOrgId = packRow.org_id;

    let jobId = existingJobId;
    if (!jobId) {
      const { data: job, error: jobErr } = await serviceClient.from("ingestion_jobs").insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString() }).select("id").single();
      if (jobErr) throw jobErr;
      jobId = job.id;
    }

    const { origin } = new URL(req.url);
    const functionUrl = `${origin}/functions/v1/ingest-source`;

    // 7. Initialize Trace
    const trace = createTrace({
      serviceName: "ingest-source",
      taskType: "ingestion",
      requestId: crypto.randomUUID(),
      packId: pack_id,
      sourceId: source_id,
      orgId: effectiveOrgId,
      environment: Deno.env.get("ENVIRONMENT") || "production",
    }, { enabled: shouldTrace() });

    trace.updateMetadata({ jobId });

    const task = runIngestion(serviceClient, jobId, pack_id, source_id, source_type, source_uri, document_content, label, source_config, effectiveOrgId, module_key, track_key, trace, functionUrl, startIndex);

    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) runtime.waitUntil(task);
    else task.catch(e => console.error("Task failed:", e));

    return json(202, { success: true, job_id: jobId }, corsHeaders);
  } catch (err: any) {
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
