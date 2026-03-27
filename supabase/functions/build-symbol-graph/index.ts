import { extractSymbols } from "../_shared/symbol-extractor.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";

const ALLOWED_ORIGINS = parseAllowedOrigins();
const SYMBOL_BATCH_SIZE = 20; // Process 20 chunks per invocation

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflight(req, ALLOWED_ORIGINS);
  if (corsResponse) return corsResponse;
  const corsHeaders = buildCorsHeaders(req, ALLOWED_ORIGINS);

  try {
    const body = await readJson(req, corsHeaders);
    const { job_id, pack_id, source_id } = body;

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

    const symbolCursor: number = state.symbol_cursor || 0;

    // Fetch a batch of chunks to process for symbols
    const { data: chunks, error: chunkErr } = await serviceClient
      .from("knowledge_chunks")
      .select("chunk_id, path, content, start_line, end_line, entity_name, exported_names, is_redacted")
      .eq("pack_id", pack_id)
      .eq("source_id", source_id)
      .eq("is_redacted", false)
      .order("chunk_id", { ascending: true })
      .range(symbolCursor, symbolCursor + SYMBOL_BATCH_SIZE - 1);

    if (chunkErr) {
      console.error("[SYMBOL] Chunk fetch error:", chunkErr);
      throw chunkErr;
    }

    if (!chunks || chunks.length === 0) {
      // All symbols processed — finalize job
      console.log(`[SYMBOL] Complete. Total symbol batches: ${state.invocations_count}`);

      // Get org_id for atomic swap
      const { data: packRow } = await serviceClient
        .from("packs")
        .select("org_id")
        .eq("id", pack_id)
        .single();

      // Atomic swap
      if (packRow?.org_id) {
        await serviceClient.from("pack_active_generation").upsert(
          { org_id: packRow.org_id, pack_id, active_generation_id: job_id, updated_at: new Date().toISOString() },
          { onConflict: "org_id,pack_id" }
        );
      }

      await serviceClient.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);

      await serviceClient.from("ingestion_job_state").update({
        phase: "completed",
        updated_at: new Date().toISOString(),
      }).eq("job_id", job_id);

      await serviceClient.from("ingestion_jobs").update({
        status: "completed",
        phase: "completed",
        completed_at: new Date().toISOString(),
      }).eq("id", job_id);

      return json(200, { status: "completed" }, corsHeaders);
    }

    console.log(`[SYMBOL] Processing symbols for chunks ${symbolCursor} to ${symbolCursor + chunks.length}`);

    const definitions: any[] = [];
    const references: any[] = [];

    for (const chunk of chunks) {
      const symbols = new Set([chunk.entity_name, ...(chunk.exported_names || [])]);
      symbols.delete("anonymous");
      symbols.delete("file_scope");
      symbols.delete(undefined);
      symbols.delete(null);

      for (const s of symbols) {
        if (!s) continue;
        definitions.push({
          pack_id, source_id, symbol: s,
          chunk_id: chunk.chunk_id, path: chunk.path,
          line_start: chunk.start_line, line_end: chunk.end_line,
        });
      }

      const ext = (chunk.path || "").split(".").pop() || "ts";
      const refs = extractSymbols(chunk.content, ext);
      for (const r of refs) {
        if (!symbols.has(r)) {
          references.push({
            pack_id, source_id, symbol: r,
            from_chunk_id: chunk.chunk_id, from_path: chunk.path,
            from_line_start: chunk.start_line, from_line_end: chunk.end_line,
            confidence: 1.0,
          });
        }
      }
    }

    if (definitions.length > 0) {
      await serviceClient.from("symbol_definitions").upsert(definitions);
    }
    if (references.length > 0) {
      await serviceClient.from("symbol_references").upsert(references);
    }

    // Advance symbol cursor
    const newCursor = symbolCursor + chunks.length;
    await serviceClient.from("ingestion_job_state").update({
      symbol_cursor: newCursor,
      invocations_count: (state.invocations_count || 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("job_id", job_id);

    await serviceClient.from("ingestion_jobs").update({
      phase: "build_symbol_graph",
    }).eq("id", job_id);

    // Self-recurse
    const { origin } = new URL(req.url);
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    fetch(`${origin}/functions/v1/build-symbol-graph`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
      body: JSON.stringify({ job_id, pack_id, source_id }),
    }).catch(e => console.error("[SYMBOL] Self-recurse failed:", e));

    return json(200, { status: "processing_symbols", cursor: newCursor }, corsHeaders);
  } catch (err: any) {
    console.error("[SYMBOL] Error:", err);
    return jsonError(500, "symbol_error", err.message, {}, corsHeaders);
  }
});
