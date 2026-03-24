import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { getSourceCredential } from "../_shared/credentials.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { validateIngestion, checkPackChunkCap } from "../_shared/ingestion-guards.ts";
import { computeContentHash, computeDeterministicChunkId } from "../_shared/hash-utils.ts";
import { processEmbeddingsWithReuse } from "../_shared/embedding-reuse.ts";
import { normalizeSlackThreadToMarkdown } from "../_shared/content-normalizers.ts";
import { fallbackChunkWords } from "../_shared/smart-chunker.ts";
import { createTrace, shouldTrace } from "../_shared/telemetry.ts";
import { readJson } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGINS")?.split(",")[0] || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function slackAPI(token: string, method: string, params: Record<string, any> = {}) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  
  let source_id: string | undefined;
  let jobId: string | undefined;
  let trace: any;

  try {
    const body = await readJson(req, corsHeaders);
    source_id = body.source_id;
    const { pack_id, source_config, org_id } = body;

    // Initialize Trace (Strategic Sampling)
    trace = createTrace({
      serviceName: 'ingest-slack',
      taskType: 'ingestion',
      requestId: crypto.randomUUID(),
      packId: pack_id,
      sourceId: source_id,
      orgId: org_id,
      environment: Deno.env.get("ENVIRONMENT") || "production",
    }, { enabled: shouldTrace() });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";
    let {
      bot_token,
      channel_ids = [],
      days_back = 30,
      threaded_only = false,
      pinned_only = false,
      min_reactions = 0,
    } = source_config || {};

    // 1. Fetch bot_token from Vault if missing
    if (!bot_token) {
      bot_token = await getSourceCredential(supabase, source_id, 'bot_token');
    }

    if (!bot_token || channel_ids.length === 0) {
      return new Response(JSON.stringify({ error: "Missing bot_token or channel_ids" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Check Ingestion Guards (Cooldown, Concurrency)
    const guard = await validateIngestion(supabase, pack_id, source_id);
    if (!guard.success) {
      return new Response(JSON.stringify({ error: guard.error, next_allowed_at: guard.next_allowed_at }), {
        status: guard.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check Pack-level Chunk Cap
    const cap = await checkPackChunkCap(supabase, pack_id);
    if (!cap.success) {
      return new Response(JSON.stringify({ error: cap.error }), {
        status: cap.status, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: job, error: jobErr } = await supabase.from("ingestion_jobs")
      .insert({ 
        pack_id, 
        source_id, 
        status: "processing", 
        started_at: new Date().toISOString(),
        retry_count: guard.retry_count || 0
      })
      .select().single();
    if (jobErr) throw jobErr;
    jobId = job.id;
    trace.updateMetadata({ jobId });

    // Build user cache for display names
    const userCache: Record<string, string> = {};
    try {
      const usersResp = await slackAPI(bot_token, "users.list", { limit: 200 });
      for (const user of usersResp.members || []) {
        userCache[user.id] = user.profile?.display_name || user.real_name || user.name || "Unknown";
      }
    } catch { /* ignore - will use IDs */ }

    // Get channel info
    const channelInfoCache: Record<string, any> = {};
    for (const channelId of channel_ids) {
      try {
        const info = await slackAPI(bot_token, "conversations.info", { channel: channelId });
        channelInfoCache[channelId] = info.channel;
      } catch {
        channelInfoCache[channelId] = { id: channelId, name: channelId };
      }
    }

    const allChunks: any[] = [];
    let chunkIdx = 0;
    const oldest = Math.floor((Date.now() - days_back * 24 * 60 * 60 * 1000) / 1000);

    for (const channelId of channel_ids) {
      const channelInfo = channelInfoCache[channelId];
      
      // Get pinned messages if requested
      let pinnedTs = new Set<string>();
      if (pinned_only) {
        try {
          const pins = await slackAPI(bot_token, "pins.list", { channel: channelId });
          for (const item of pins.items || []) {
            if (item.message?.ts) pinnedTs.add(item.message.ts);
          }
        } catch { /* ignore */ }
      }

      // Fetch message history
      let messages: any[] = [];
      let cursor: string | undefined;
      let fetchCount = 0;
      const maxFetches = 10; // Max 1000 messages per channel

      const historySpan = trace.startSpan("fetch_history", { channel_id: channelId });
      while (fetchCount < maxFetches) {
        const historyResp = await slackAPI(bot_token, "conversations.history", {
          channel: channelId,
          oldest,
          limit: 100,
          cursor,
        });
        messages.push(...(historyResp.messages || []));
        cursor = historyResp.response_metadata?.next_cursor;
        if (!cursor) break;
        fetchCount++;
      }
      historySpan.end({ count: messages.length });

      // Filter messages based on criteria
      const filteredMessages = messages.filter(msg => {
        if (msg.subtype === "channel_join" || msg.subtype === "channel_leave") return false;
        if (pinned_only && !pinnedTs.has(msg.ts)) return false;
        if (threaded_only && !msg.reply_count) return false;
        if (min_reactions > 0 && (!msg.reactions || msg.reactions.length < min_reactions)) return false;
        return true; // All messages that pass basic filters are considered for normalization
      });

      // Process each valuable message (with threads if applicable)
      for (const mainMsg of filteredMessages) {
        let thread: any[] = [];
        if (mainMsg.reply_count && mainMsg.reply_count > 0) {
          // Fetch thread
          const threadSpan = trace.startSpan("fetch_thread", { channel_id: channelId, ts: mainMsg.ts });
          try {
            const threadResp = await slackAPI(bot_token, "conversations.replies", {
              channel: channelId,
              ts: mainMsg.ts,
              limit: 50,
            });
            thread = threadResp.messages || [];
          } catch (e) {
            console.warn(`Failed to fetch thread for ${mainMsg.ts} in ${channelId}: ${e.message}`);
            thread = [mainMsg]; // Fallback to just the main message if thread fetch fails
          } finally {
            threadSpan.end({ count: thread.length });
          }
        } else {
          thread = [mainMsg];
        }

        const channelName = channelInfo.name || "unknown-channel";
        const date = new Date(parseFloat(mainMsg.ts) * 1000).toLocaleDateString();
        const markdown = normalizeSlackThreadToMarkdown(channelName, date, thread, userCache);

        const pagePath = `slack:${channelId}/${mainMsg.ts}`;
        const wordChunks = fallbackChunkWords(markdown);

        for (const chunk of wordChunks) {
          chunkIdx++;
          const assessment = assessChunkRedaction(chunk.text);
          if (assessment.action === "exclude") continue;

          const hash = await computeContentHash(assessment.contentToStore);
          const chunkId = await computeDeterministicChunkId(pagePath, chunk.start, chunk.end, hash);

          allChunks.push({
            chunk_id: chunkId,
            path: pagePath,
            start_line: chunk.start,
            end_line: chunk.end,
            content: assessment.contentToStore,
            content_hash: hash,
            is_redacted: assessment.isRedacted,
            pack_id,
            source_id,
            ingestion_job_id: jobId,
            metadata: {
              channel_id: channelId,
              channel_name: channelName,
              message_ts: mainMsg.ts,
              reply_count: mainMsg.reply_count || 0,
              reaction_count: mainMsg.reactions?.length || 0,
              redaction: assessment.metrics
            },
          });
        }
      }

      await supabase.from("ingestion_jobs").update({ processed_chunks: allChunks.length }).eq("id", jobId);
    }

    const chunks = allChunks; // for compatibility with downstream code

    await supabase.from("ingestion_jobs").update({ total_chunks: chunks.length }).eq("id", jobId);
    trace.addSpan({ name: "chunk_summary", startTime: Date.now(), endTime: Date.now(), output: { total_chunks: chunks.length, channels: channel_ids.length } });

    // 4. Handle Embeddings (Reuse + Generation)
    const embedSpan = trace.startSpan("process_embeddings", { count: chunks.length });
    const { reusedCount, generatedCount } = await processEmbeddingsWithReuse(
      supabase,
      pack_id,
      source_id,
      chunks,
      openAIApiKey
    );
    embedSpan.end({ reusedCount, generatedCount });
    if (generatedCount > 0) trace.enable();

    // Upsert chunks
    for (let i = 0; i < chunks.length; i += 100) {
      await supabase.from("knowledge_chunks").upsert(chunks.slice(i, i + 100), { onConflict: "pack_id,chunk_id" });
    }

    await supabase.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);
    await supabase.from("ingestion_jobs").update({
      status: "completed",
      processed_chunks: chunks.length,
      completed_at: new Date().toISOString(),
      metadata: {
        total_chunks: chunks.length,
        embeddings_reused_count: reusedCount,
        embeddings_generated_count: generatedCount,
        trace_id: trace.getTraceId()
      }
    }).eq("id", jobId);

    await trace.flush();

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: chunks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Slack ingestion error:", err);

    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      if (source_id) {
        await supabase
          .from("ingestion_jobs")
          .update({
            status: "failed",
            completed_at: new Date().toISOString(),
            error_message: (err.message ?? "Unknown error").slice(0, 500),
            last_error_at: new Date().toISOString(),
            last_error_message: (err.message ?? "Unknown error").slice(0, 500),
          })
          .eq("source_id", source_id)
          .eq("status", "processing");

        // CLEANUP: Delete partial chunks for this failed job
        if (typeof jobId !== "undefined") {
          console.log(`[CLEANUP] Deleting partial chunks for failed job ${jobId}`);
          await supabase.from("knowledge_chunks").delete().eq("ingestion_job_id", jobId);
        }
      }
    } catch (innerErr) {
       console.error("Secondary failure in catch block:", innerErr);
    }

    if (typeof trace !== "undefined") {
      trace.setError(err.message).enable();
      await trace.flush();
    }
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
