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

// Redaction now handled by centralized secret-patterns.ts

const SUPPORTED_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".md",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".rb",
  ".sh",
  ".bash",
  ".css",
  ".scss",
  ".html",
  ".sql",
  ".graphql",
  ".gql",
  ".tf",
]);

const SUPPORTED_FILENAMES = new Set([
  "Dockerfile",
  "Makefile",
  ".env.example",
  ".env.sample",
  "docker-compose.yml",
  "docker-compose.yaml",
  "Jenkinsfile",
  "README.md",
  "README",
  "CONTRIBUTING.md",
  "SETUP.md",
]);

// Setup-relevant file patterns for metadata tagging
const SETUP_PATTERNS: Record<string, RegExp[]> = {
  dependencies: [
    /^package\.json$/,
    /^requirements\.txt$/,
    /^Gemfile$/,
    /^go\.mod$/,
    /^Cargo\.toml$/,
    /^pom\.xml$/,
    /^build\.gradle$/,
  ],
  configuration: [
    /^\.env/,
    /^config\//,
    /\.config\.(js|ts|json|yaml|yml)$/,
    /settings\.(json|yaml|yml)$/,
  ],
  docker: [
    /^Dockerfile/,
    /^docker-compose/,
    /\.dockerfile$/i,
  ],
  ci_cd: [
    /^\.github\/workflows\//,
    /^\.gitlab-ci\.yml$/,
    /^Jenkinsfile$/,
    /^\.circleci\//,
    /^azure-pipelines\.yml$/,
  ],
  environment: [
    /^Makefile$/,
    /^scripts\//,
    /^bin\//,
    /^README/i,
    /^CONTRIBUTING/i,
    /^SETUP/i,
    /^INSTALL/i,
  ],
  infrastructure: [
    /^terraform\//,
    /^k8s\//,
    /^kubernetes\//,
    /^helm\//,
    /\.tf$/,
  ],
};

function getSetupMetadata(
  filepath: string,
): { is_setup_relevant: boolean; setup_category?: string } {
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
  // Check for special filenames that start with common patterns
  if (
    basename.startsWith("README") || basename.startsWith("CONTRIBUTING") ||
    basename.startsWith("SETUP")
  ) return true;
  const ext = "." + basename.split(".").pop();
  return SUPPORTED_EXTENSIONS.has(ext);
}

// Local redactSecrets removed in favor of assessChunkRedaction()

function chunkWords(
  text: string,
  wordCount = 500,
): { start: number; end: number; text: string }[] {
  const words = text.split(/\s+/);
  const chunks: { start: number; end: number; text: string }[] = [];
  let i = 0;
  let lineEstimate = 1;
  while (i < words.length) {
    const end = Math.min(i + wordCount, words.length);
    const chunk = words.slice(i, end).join(" ");
    const lines = chunk.split("\n").length;
    chunks.push({
      start: lineEstimate,
      end: lineEstimate + lines - 1,
      text: chunk,
    });
    lineEstimate += lines;
    i = end;
  }
  return chunks;
}

// Local sha256 removed in favor of computeContentHash

async function generateEmbedding(
  text: string,
  apiKey: string,
): Promise<number[] | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text.replace(/\n/g, " "),
        model: "text-embedding-3-small",
      }),
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

function parseCodeowners(
  content: string,
): { pattern: string; owners: string[] }[] {
  const lines = content.split("\n");
  const rules: { pattern: string; owners: string[] }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      rules.push({ pattern: parts[0], owners: parts.slice(1) });
    }
  }
  return rules;
}

async function fetchTextWithTimeout(
  url: string,
  options: RequestInit & { timeout?: number } = {},
): Promise<string> {
  const { timeout = 30000, ...fetchOptions } = options;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
    });
    if (!response.ok) return "";
    return await response.text();
  } catch (err: any) {
    if (err.name === "AbortError") {
      console.warn(`[FETCH] Timeout reading ${url} after ${timeout}ms`);
    } else {
      console.error(`[FETCH] Error reading ${url}:`, err.message);
    }
    return "";
  } finally {
    clearTimeout(id);
  }
}

async function fetchGitHubTree(
  owner: string,
  repo: string,
  token?: string,
): Promise<string[]> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) headers.Authorization = `token ${token}`;

  const timeout = 60000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
    const resp = await fetch(url, { headers, signal: controller.signal });
    if (!resp.ok) {
      const err = await resp.text();
      if (resp.status === 403) throw new Error("GitHub Rate Limit");
      throw new Error(`GitHub Error: ${resp.status}`);
    }
    const data = await resp.json();
    return (data.tree || [])
      .filter((item: any) => item.type === "blob" && isSupported(item.path))
      .map((item: any) => item.path);
  } finally {
    clearTimeout(id);
  }
}

async function fetchGitHubFile(
  owner: string,
  repo: string,
  path: string,
  token?: string,
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3.raw",
  };
  if (token) headers.Authorization = `token ${token}`;

  return await fetchTextWithTimeout(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    { headers, timeout: 30000 },
  );
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
) {
  const startMs = Date.now();
  const updatePhase = async (phase: string, extra?: Record<string, any>) => {
    await serviceClient.from("ingestion_jobs").update({
      phase,
      elapsed_ms: Date.now() - startMs,
      ...extra,
    }).eq("id", jobId);
  };

  try {
    const controller = new AbortController();
    const abortSignal = controller.signal;
    let hbStatus: string | null = null;
    let allChunks: {
      chunk_id: string;
      path: string;
      start_line: number;
      end_line: number;
      content: string;
      content_hash: string;
      is_redacted: boolean;
      metadata?: Record<string, any>;
      embedding?: number[];
      entity_type?: string;
      entity_name?: string;
      signature?: string;
      imports?: string[];
      exported_names?: string[];
    }[] = [];
    let totalRedactions = 0;

    let githubToken: string | undefined = undefined;
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") ||
      Deno.env.get("LOVABLE_API_KEY") || "";

    if (source_type === "github_repo") {
      let validatedUri: string;
      try {
        validatedUri = parseAndValidateExternalUrl(source_uri!, {
          allowedHosts: ["github.com"],
          disallowPrivateIPs: true,
          allowHttps: true,
        });
      } catch (err: any) {
        console.error(
          `[SSRF BLOCK] Invalid GitHub source_uri: ${source_uri}`,
          err.message,
        );
        throw new Error(`Invalid Source URI: ${err.message}`);
      }

      const match = validatedUri.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error("Invalid GitHub repo URL");
      const [, owner, repo] = match;

      await updatePhase("fetch_tree");
      const fetchTreeSpan = trace.startSpan("fetch_tree", { owner, repo });
      let files: string[] = [];
      try {
        if (!githubToken) {
          const credential = await getSourceCredential(
            serviceClient,
            source_id,
            "api_token",
          );
          githubToken = credential ?? undefined;
        }
        if (!githubToken) {
          githubToken = Deno.env.get("GITHUB_TOKEN") || undefined;
        }

        files = await fetchGitHubTree(
          owner,
          repo.replace(/\.git$/, ""),
          githubToken || undefined,
        );
        fetchTreeSpan.end({ count: files.length });
      } catch (err: any) {
        fetchTreeSpan.error(err.message);
        throw err;
      }

      // Check for CODEOWNERS
      const codeownersPath = files.find((f) =>
        f.endsWith("CODEOWNERS") || f === ".github/CODEOWNERS" ||
        f === "docs/CODEOWNERS"
      );
      if (codeownersPath) {
        const coContent = await fetchGitHubFile(
          owner,
          repo.replace(/\.git$/, ""),
          codeownersPath,
          githubToken,
        );
        if (coContent) {
          const rules = parseCodeowners(coContent);
          if (rules.length > 0) {
            const ownersToInsert = rules.map((r) => ({
              pack_id,
              path_pattern: r.pattern,
              owner_ids: r.owners,
              metadata: { source: codeownersPath },
            }));
            await serviceClient.from("knowledge_owners").upsert(
              ownersToInsert,
              { onConflict: "pack_id,path_pattern" },
            );
          }
        }
      }

      const repoName = repo.replace(/\.git$/, "");
      await serviceClient.from("ingestion_jobs").update({
        total_chunks: files.length,
      }).eq("id", jobId);

      let chunkIdx = 0;
      const PARALLEL_BATCH_SIZE = 5;

      for (let i = 0; i < files.length; i += PARALLEL_BATCH_SIZE) {
        // Heartbeat / Cancellation check BEFORE each batch
        hbStatus = await updateHeartbeat(serviceClient, jobId);
        if (hbStatus && hbStatus !== "processing") {
          console.log(
            `[CANCEL] Job ${jobId} status is ${hbStatus}, aborting batch at file ${i}.`,
          );
          controller.abort();
          return;
        }

        const batchFiles = files.slice(i, i + PARALLEL_BATCH_SIZE);
        console.log(
          `[INGEST] Processing batch ${i / PARALLEL_BATCH_SIZE + 1}: ${
            batchFiles.join(", ")
          }`,
        );

        const fetchResults = await Promise.all(
          batchFiles.map(async (filepath) => {
            try {
              const fileContent = await fetchGitHubFile(
                owner,
                repoName,
                filepath,
                githubToken,
              );
              return { filepath, fileContent };
            } catch (err) {
              console.error(`[INGEST] Failed to fetch ${filepath}:`, err);
              return { filepath, fileContent: "" };
            }
          }),
        );

        for (const { filepath, fileContent } of fetchResults) {
          if (!fileContent) continue;

          console.log(
            `[INGEST] Chunking file: ${filepath} (${fileContent.length} bytes)`,
          );
          const chunks = await astChunk(fileContent, filepath, abortSignal);
          console.log(
            `[INGEST] Produced ${chunks.length} chunks for ${filepath}`,
          );
          const sourceUrl =
            `https://github.com/${owner}/${repoName}/blob/main/${filepath}`;
          const setupMeta = getSetupMetadata(filepath);

          for (const chunk of chunks) {
            chunkIdx++;
            if (chunkIdx > getRunCap()) {
              throw new Error(
                `Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`,
              );
            }
            const assessment = assessChunkRedaction(chunk.text);
            if (assessment.metrics.secretsFound > 0) {
              totalRedactions += assessment.metrics.secretsFound;
            }

            const hash = await computeContentHash(assessment.contentToStore);

            allChunks.push({
              chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
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
                source_url: sourceUrl,
                ...setupMeta,
                entity_type: chunk.metadata.entity_type,
                entity_name: chunk.metadata.entity_name,
                signature: chunk.metadata.signature,
                imports: chunk.metadata.imports,
                exported_names: chunk.metadata.exported_names || [],
                module_key: module_key || null,
                track_key: track_key || null,
                ingestion_job_id: jobId,
                generation_id: jobId,
                redaction: {
                  action: assessment.action,
                  secretsFound: assessment.metrics.secretsFound,
                  matchedPatterns: assessment.metrics.matchedPatterns,
                  redactionRatio: assessment.metrics.redactionRatio,
                },
              },
              embedding: undefined,
            });
          }
          await updateHeartbeat(serviceClient, jobId, {
            total_chunks: allChunks.length,
          });
        }

        // Use 'i + batchFiles.length' as processed_chunks to represent FILE progress
        // This keeps the UI progress bar moving 1-to-1 with files.
        hbStatus = await updateHeartbeat(serviceClient, jobId, {
          processed_chunks: Math.min(i + batchFiles.length, files.length),
        });

        if (hbStatus && hbStatus !== "processing") {
          console.log(
            `[CANCEL] Job ${jobId} status is ${hbStatus}, aborting ingestion.`,
          );
          controller.abort();
          return;
        }
      }

      await updateHeartbeat(serviceClient, jobId, {
        total_chunks: allChunks.length,
      });

      trace.addSpan({
        name: "chunk_summary",
        startTime: Date.now(),
        endTime: Date.now(),
        output: {
          total_chunks: allChunks.length,
          total_redactions: totalRedactions,
        },
      });
    } else if (source_type === "document") {
      const text = document_content || "";
      const docLabel = label || source_uri || "untitled";
      const chunks = chunkWords(text);

      let chunkIdx = 0;
      for (const chunk of chunks) {
        chunkIdx++;
        const assessment = assessChunkRedaction(chunk.text);
        if (assessment.metrics.secretsFound > 0) {
          totalRedactions += assessment.metrics.secretsFound;
        }
        const hash = await computeContentHash(assessment.contentToStore);

        allChunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `doc:${docLabel}`,
          start_line: chunk.start,
          end_line: chunk.end,
          content: assessment.contentToStore,
          content_hash: hash,
          is_redacted: assessment.isRedacted,
          metadata: {
            file_type: "document",
            source_url: source_uri || null,
            module_key: module_key || null,
            track_key: track_key || null,
            ingestion_job_id: jobId,
            generation_id: jobId,
            redaction: {
              action: assessment.action,
              secretsFound: assessment.metrics.secretsFound,
              matchedPatterns: assessment.metrics.matchedPatterns,
              redactionRatio: assessment.metrics.redactionRatio,
            },
          },
          embedding: undefined,
        });
      }
    } else {
      throw new Error(`Unsupported source_type for background: ${source_type}`);
    }

    if (totalRedactions > 0) {
      console.log(
        `[REDACTION SUMMARY] Total redactions for source ${source_id}: ${totalRedactions}`,
      );
    }

    const indexableChunks = allChunks.filter((c) => !c.is_redacted);

    // Process embeddings with error handling for quota issues
    const embedSpan = trace.startSpan("process_embeddings", {
      count: allChunks.length,
    });

    let reusedCount = 0;
    let generatedCount = 0;
    try {
      const result = await processEmbeddingsWithReuse(
        serviceClient,
        pack_id,
        source_id,
        allChunks,
        openAIApiKey,
        jobId,
      );
      reusedCount = result.reusedCount;
      generatedCount = result.generatedCount;
    } catch (embErr: any) {
      console.error(
        "[EMBEDDING] Embedding processing failed, continuing without embeddings:",
        embErr.message,
      );
    }
    embedSpan.end({ reusedCount, generatedCount });
    if (generatedCount > 0) trace.enable();

    // Upsert chunks — only include columns that exist in knowledge_chunks table
    const upsertSpan = trace.startSpan("db_upsert_batch", {
      total: allChunks.length,
    });
    const BATCH_SIZE = 100;
    let processed = 0;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE).map((c) => ({
        pack_id,
        source_id,
        chunk_id: c.chunk_id,
        path: c.path,
        start_line: c.start_line,
        end_line: c.end_line,
        content: c.content,
        content_hash: c.content_hash,
        imports: c.imports,
        exported_names: c.exported_names,
        entity_type: c.entity_type,
        entity_name: c.entity_name,
        signature: c.signature,
        is_redacted: c.is_redacted,
        metadata: c.metadata,
        embedding: c.embedding,
      }));

      const { error: upsertErr } = await serviceClient
        .from("knowledge_chunks")
        .upsert(batch, { onConflict: "pack_id,chunk_id" });

      if (upsertErr) {
        console.error("Upsert error:", upsertErr);
      }

      processed += batch.length;
      hbStatus = await updateHeartbeat(serviceClient, jobId, {
        processed_chunks: processed,
      });
      if (hbStatus && hbStatus !== "processing") {
        console.log(
          `[CANCEL] Job ${jobId} status is ${hbStatus}, aborting upsert batch.`,
        );
        return;
      }
    }
    upsertSpan.end({ processed });

    // Populate Graph Tables
    const graphSpan = trace.startSpan("populate_graph", {
      total_chunks: allChunks.length,
    });

    await serviceClient.from("symbol_definitions").delete().eq(
      "source_id",
      source_id,
    );
    await serviceClient.from("symbol_references").delete().eq(
      "source_id",
      source_id,
    );

    const definitionsBatch: any[] = [];
    const referencesBatch: any[] = [];

    let loopIdx = 0;
    for (const chunk of allChunks) {
      loopIdx++;
      if (chunk.is_redacted) continue;

      const symbolsToDefine = new Set<string>();
      if (
        chunk.entity_name && chunk.entity_name !== "anonymous" &&
        chunk.entity_name !== "file_scope"
      ) {
        symbolsToDefine.add(chunk.entity_name);
      }
      if (chunk.exported_names) {
        chunk.exported_names.forEach((name) => symbolsToDefine.add(name));
      }

      for (const symbol of symbolsToDefine) {
        definitionsBatch.push({
          pack_id,
          source_id,
          symbol,
          chunk_id: chunk.chunk_id,
          path: chunk.path,
          line_start: chunk.start_line,
          line_end: chunk.end_line,
        });
      }

      const lang = chunk.path.split(".").pop() || "typescript";
      const refs = extractSymbols(chunk.content, lang);
      for (const symbol of refs) {
        if (symbolsToDefine.has(symbol)) continue;

        referencesBatch.push({
          pack_id,
          source_id,
          symbol,
          from_chunk_id: chunk.chunk_id,
          from_path: chunk.path,
          from_line_start: chunk.start_line,
          from_line_end: chunk.end_line,
          confidence: 1.0,
        });
      }
      // Heartbeat every 50 chunks during the heavy symbol extraction loop
      if (jobId && loopIdx % 50 === 0) {
        await updateHeartbeat(serviceClient, jobId);
      }
    }

    const GRAPH_UPSERT_BATCH_SIZE = 500;
    const DB_CONCURRENCY = 5;

    if (definitionsBatch.length > 0) {
      for (
        let i = 0;
        i < definitionsBatch.length;
        i += GRAPH_UPSERT_BATCH_SIZE * DB_CONCURRENCY
      ) {
        const group = [];
        for (let j = 0; j < DB_CONCURRENCY; j++) {
          const offset = i + (j * GRAPH_UPSERT_BATCH_SIZE);
          if (offset < definitionsBatch.length) {
            const batch = definitionsBatch.slice(
              offset,
              offset + GRAPH_UPSERT_BATCH_SIZE,
            );
            group.push(serviceClient.from("symbol_definitions").upsert(batch));
          }
        }
        if (group.length > 0) {
          await Promise.all(group);
          if (jobId) await updateHeartbeat(serviceClient, jobId);
        }
      }
    }

    if (referencesBatch.length > 0) {
      for (
        let i = 0;
        i < referencesBatch.length;
        i += GRAPH_UPSERT_BATCH_SIZE * DB_CONCURRENCY
      ) {
        const group = [];
        for (let j = 0; j < DB_CONCURRENCY; j++) {
          const offset = i + (j * GRAPH_UPSERT_BATCH_SIZE);
          if (offset < referencesBatch.length) {
            const batch = referencesBatch.slice(
              offset,
              offset + GRAPH_UPSERT_BATCH_SIZE,
            );
            group.push(serviceClient.from("symbol_references").upsert(batch));
          }
        }
        if (group.length > 0) {
          await Promise.all(group);
          if (jobId) await updateHeartbeat(serviceClient, jobId);
        }
      }
    }
    graphSpan.end({
      definitions: definitionsBatch.length,
      references: referencesBatch.length,
    });

    // Update source last_synced_at
    await serviceClient.from("pack_sources").update({
      last_synced_at: new Date().toISOString(),
    }).eq("id", source_id);

    // Atomic Swap
    await serviceClient.from("pack_active_generation").upsert({
      org_id,
      pack_id,
      active_generation_id: jobId,
      updated_at: new Date().toISOString(),
    }, { onConflict: "org_id,pack_id" });

    // Mark job completed
    const redactionSummary = {
      total: allChunks.length,
      clean: allChunks.filter((c) =>
        !c.metadata?.redaction || c.metadata.redaction.action === "clean"
      ).length,
      redactedAndIndexed: allChunks.filter((c) =>
        c.metadata?.redaction?.action === "redact_and_index"
      ).length,
      excluded: allChunks.filter((c) =>
        c.metadata?.redaction?.action === "exclude"
      ).length,
    };

    await updateHeartbeat(serviceClient, jobId, {
      status: "completed",
      processed_chunks: allChunks.length,
      completed_at: new Date().toISOString(),
    });

    await trace.flush();
    console.log(
      `[INGESTION] Completed job ${jobId} with ${allChunks.length} chunks`,
    );
  } catch (err: any) {
    console.error("Background ingestion error:", err);
    try {
      await serviceClient
        .from("ingestion_jobs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: (err.message ?? "Unknown error").slice(0, 500),
        })
        .eq("id", jobId)
        .eq("status", "processing");

      // CLEANUP: Delete partial chunks for this failed job
      console.log(
        `[CLEANUP] Deleting partial chunks for failed job ${jobId}`,
      );
      await serviceClient.from("knowledge_chunks").delete().match({
        pack_id,
        source_id,
      });
    } catch (innerErr) {
      console.error("Secondary failure in background catch block:", innerErr);
    }

    if (trace) {
      trace.setError(err.message).enable();
      await trace.flush();
    }
  }
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);
  const origin = req.headers.get("Origin");

  if (Deno.env.get("STRICT_CORS") === "true") {
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
      console.error(`[STRICT_CORS] Forbidden origin: ${origin}`);
      return jsonError(
        403,
        "forbidden_origin",
        `Origin ${origin} is not allowlisted`,
        {},
        corsHeaders,
      );
    }
  }

  try {
    const body = await readJson(req, corsHeaders);
    const {
      pack_id,
      source_type,
      source_uri,
      document_content,
      label,
      source_config,
      org_id,
      module_key,
      track_key,
    } = body;
    const source_id = body.source_id;

    if (!pack_id || !source_id || !source_type) {
      return jsonError(
        400,
        "bad_request",
        "Missing required fields (pack_id, source_id, source_type)",
        {},
        corsHeaders,
      );
    }

    // 1. Authenticate user
    const { userId } = await requireUser(req, corsHeaders);

    // 2. Authorize pack access
    const serviceClient = createServiceClient();
    await requirePackRole(
      serviceClient,
      pack_id,
      userId,
      "author",
      corsHeaders,
    );

    // 3. Check Ingestion Guards
    const guard = await validateIngestion(serviceClient, pack_id, source_id);
    if (!guard.success) {
      return json(guard.status ?? 400, {
        error: guard.error,
        next_allowed_at: guard.next_allowed_at,
      }, corsHeaders);
    }

    // 4. Check Pack-level Chunk Cap
    const cap = await checkPackChunkCap(serviceClient, pack_id);
    if (!cap.success) {
      return json(cap.status ?? 400, { error: cap.error }, corsHeaders);
    }

    // 5. For provider-specific sources, route immediately (no background needed)
    if (
      [
        "confluence",
        "notion",
        "google_drive",
        "sharepoint",
        "jira",
        "linear",
        "openapi_spec",
        "postman_collection",
        "figma",
        "slack_channel",
        "loom_video",
        "pagerduty",
      ].includes(source_type)
    ) {
      const functionNameMap: Record<string, string> = {
        google_drive: "ingest-google-drive",
        openapi_spec: "ingest-openapi",
        postman_collection: "ingest-postman",
        slack_channel: "ingest-slack",
        loom_video: "ingest-loom",
      };
      const functionName = functionNameMap[source_type] ||
        `ingest-${source_type}`;
      const serviceClientUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      const routeResp = await fetch(
        `${serviceClientUrl}/functions/v1/${functionName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            pack_id,
            source_id,
            source_config: source_config || {},
          }),
        },
      );

      if (!routeResp.ok) {
        const errData = await routeResp.json().catch(() => ({
          error: "Provider ingestion failed",
        }));
        throw new Error(errData.error || `${source_type} ingestion failed`);
      }

      const result = await routeResp.json();
      return json(200, result, corsHeaders);
    }

    const { data: job, error: jobErr } = await serviceClient
      .from("ingestion_jobs")
      .insert({
        pack_id,
        source_id,
        status: "processing",
        started_at: new Date().toISOString(),
        retry_count: guard.retry_count || 0,
      })
      .select("id")
      .single();

    if (jobErr || !job?.id) {
      console.error("[INGESTION] Created job failed", jobErr);
      return jsonError(
        500,
        "ingestion_job_create_failed",
        `Failed to initialize job: ${jobErr?.message}`,
        {},
        corsHeaders,
      );
    }

    const jobId = job.id;
    console.log("[INGESTION] created job", jobId);

    // 7. Initialize Trace
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

    console.log("[INGESTION] scheduling background ingestion", {
      jobId,
      source_type,
    });

    const task = runIngestion(
      serviceClient,
      jobId,
      pack_id,
      source_id,
      source_type,
      source_uri,
      document_content,
      label,
      source_config,
      org_id,
      module_key || null,
      track_key || null,
      trace,
    );

    // Use EdgeRuntime.waitUntil for true background processing on Supabase
    const runtime = (globalThis as any).EdgeRuntime;
    if (runtime?.waitUntil) {
      runtime.waitUntil(task);
    } else {
      // Local dev/fallback behavior
      task.catch((e) =>
        console.error("[INGESTION] background task error", e.message)
      );
    }

    // 9. Return immediately (202 Accepted)
    return json(202, {
      success: true,
      job_id: jobId,
      status: "processing",
      message: "Ingestion scheduled",
    }, corsHeaders);
  } catch (err: any) {
    console.error("Ingestion error:", err);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
