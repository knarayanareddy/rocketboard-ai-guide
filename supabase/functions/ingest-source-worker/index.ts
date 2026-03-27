import { astChunk } from "../_shared/ast-chunker.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { computeContentHash } from "../_shared/hash-utils.ts";
import { updateHeartbeat } from "../_shared/ingestion-guards.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { getSourceCredential } from "../_shared/credentials.ts";

const ALLOWED_ORIGINS = parseAllowedOrigins();
const BATCH_SIZE = 3; // Very small to stay well under 2s CPU

async function fetchGitHubFile(owner: string, repo: string, path: string, token?: string): Promise<string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3.raw" };
  if (token) headers.Authorization = `token ${token}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers, signal: controller.signal });
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timeout);
  }
}

function getSetupMetadata(filepath: string): { is_setup_relevant: boolean; setup_category?: string } {
  const SETUP_PATTERNS: Record<string, RegExp[]> = {
    dependencies: [/^package\.json$/, /^requirements\.txt$/, /^Gemfile$/, /^go\.mod$/, /^Cargo\.toml$/],
    configuration: [/^\.env/, /^config\//, /\.config\.(js|ts|json|yaml|yml)$/],
    docker: [/^Dockerfile/, /^docker-compose/],
    ci_cd: [/^\.github\/workflows\//, /^\.gitlab-ci\.yml$/],
    environment: [/^Makefile$/, /^scripts\//, /^README/i],
    infrastructure: [/^terraform\//, /\.tf$/],
  };
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

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  try {
    const body = await readJson(req, corsHeaders);
    const { job_id, pack_id, source_id, owner, repo, token, module_key, track_key } = body;

    const serviceClient = createServiceClient();

    // Read current state
    const { data: state, error: stateErr } = await serviceClient
      .from("ingestion_job_state")
      .select("*")
      .eq("job_id", job_id)
      .single();

    if (stateErr || !state) {
      return jsonError(404, "state_not_found", "Job state not found", {}, corsHeaders);
    }

    const fileTree: string[] = state.file_tree || [];
    const cursor: number = state.cursor;
    const batchFiles = fileTree.slice(cursor, cursor + BATCH_SIZE);

    if (batchFiles.length === 0) {
      // All files processed — move to symbol graph phase
      await serviceClient.from("ingestion_job_state").update({
        phase: "symbol_graph",
        updated_at: new Date().toISOString(),
      }).eq("job_id", job_id);

      await serviceClient.from("ingestion_jobs").update({
        phase: "build_symbol_graph",
        processed_chunks: cursor,
      }).eq("id", job_id);

      // Invoke build-symbol-graph
      const { origin } = new URL(req.url);
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${origin}/functions/v1/build-symbol-graph`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
        body: JSON.stringify({ job_id, pack_id, source_id }),
      }).catch(e => console.error("[WORKER] Failed to invoke symbol graph builder:", e));

      return json(200, { status: "symbol_graph_phase", files_done: cursor }, corsHeaders);
    }

    console.log(`[WORKER] Processing batch: files ${cursor} to ${cursor + batchFiles.length} of ${fileTree.length}`);

    await updateHeartbeat(serviceClient, job_id, {
      phase: "fetch_files",
      processed_chunks: cursor,
      current_file_index: cursor,
    });

    const githubToken = token || undefined;
    const chunks: any[] = [];
    const controller = new AbortController();

    for (let i = 0; i < batchFiles.length; i++) {
      const filepath = batchFiles[i];
      const globalIdx = cursor + i;

      await serviceClient.from("ingestion_jobs").update({
        phase: "chunking",
        current_file: filepath,
        current_file_index: globalIdx,
      }).eq("id", job_id);

      const content = await fetchGitHubFile(owner, repo, filepath, githubToken);
      if (!content) continue;

      let fileChunks;
      try {
        fileChunks = await astChunk(content, filepath, controller.signal);
      } catch {
        // Fallback: single chunk
        fileChunks = [{ text: content, metadata: { line_start: 1, line_end: content.split("\n").length, entity_type: "file_scope", entity_name: filepath.split("/").pop(), signature: null, imports: [], exported_names: [] } }];
      }

      const setupMeta = getSetupMetadata(filepath);
      const sourceUrl = `https://github.com/${owner}/${repo}/blob/main/${filepath}`;

      for (let j = 0; j < fileChunks.length; j++) {
        const chunk = fileChunks[j];
        const assessment = assessChunkRedaction(chunk.text);
        const hash = await computeContentHash(assessment.contentToStore);
        chunks.push({
          pack_id, source_id,
          chunk_id: `C${String(globalIdx + 1).padStart(5, "0")}_${j}`,
          path: `repo:${owner}/${repo}/${filepath}`,
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
            ingestion_job_id: job_id, generation_id: job_id,
            module_key, track_key,
          },
        });
      }
    }

    // Upsert chunks
    if (chunks.length > 0) {
      await serviceClient.from("ingestion_jobs").update({ phase: "upsert_chunks" }).eq("id", job_id);
      const { error: upsertError } = await serviceClient.from("knowledge_chunks").upsert(chunks);
      if (upsertError) {
        console.error("[WORKER] Upsert error:", upsertError);
        throw upsertError;
      }
    }

    // Advance cursor
    const newCursor = cursor + batchFiles.length;
    await serviceClient.from("ingestion_job_state").update({
      cursor: newCursor,
      invocations_count: (state.invocations_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("job_id", job_id);

    await updateHeartbeat(serviceClient, job_id, {
      phase: "fetch_files",
      processed_chunks: newCursor,
      current_file_index: newCursor,
    });

    // Self-recurse for next batch
    const { origin } = new URL(req.url);
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${origin}/functions/v1/ingest-source-worker`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ job_id, pack_id, source_id, owner, repo, token: githubToken, module_key, track_key }),
    }).catch(e => console.error("[WORKER] Self-recurse failed:", e));

    return json(200, { status: "processing", cursor: newCursor, total: fileTree.length }, corsHeaders);
  } catch (err: any) {
    console.error("[WORKER] Error:", err);
    return jsonError(500, "worker_error", err.message, {}, corsHeaders);
  }
});
