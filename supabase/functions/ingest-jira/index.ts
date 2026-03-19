import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSourceCredential } from "../_shared/credentials.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
import { validateIngestion, checkPackChunkCap, getRunCap } from "../_shared/ingestion-guards.ts";
import { computeContentHash, computeDeterministicChunkId } from "../_shared/hash-utils.ts";
import { processEmbeddingsWithReuse } from "../_shared/embedding-reuse.ts";
import { normalizeJiraIssueToMarkdown } from "../_shared/content-normalizers.ts";
import { chunkMarkdownByHeadings } from "../_shared/smart-chunker.ts";
import { createTrace, shouldTrace } from "../_shared/telemetry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Local sha256 removed in favor of computeContentHash

// Normalization and chunking moved to shared modules

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let source_id: string | undefined;
  let jobId: string | undefined;
  let trace: any;

  try {
    const body = await req.json();
    source_id = body.source_id;
    const { pack_id, source_config, org_id } = body;

    // Initialize Trace (Strategic Sampling)
    trace = createTrace({
      serviceName: 'ingest-jira',
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

    let { base_url, project_key, auth_email, api_token, max_issues = 200, include_epics = true, include_recent = true, include_comments = false, include_resolved = false } = source_config || {};

    // 1. Fetch api_token from Vault if missing
    if (!api_token) {
      api_token = await getSourceCredential(supabase, source_id, 'api_token');
    }

    if (!base_url || !project_key || !auth_email || !api_token) {
      return new Response(JSON.stringify({ error: "Missing Jira configuration" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Validate URL (SSRF Protection)
    let validatedBaseUrl: string;
    try {
      const allowedHosts = Deno.env.get("ALLOWED_JIRA_HOSTS")?.split(",") || [];
      validatedBaseUrl = parseAndValidateExternalUrl(base_url, {
        allowedHostSuffixes: [".atlassian.net", ...allowedHosts],
        allowHttps: true,
      });
      // Ensure no trailing slash for cleaner concatenation
      validatedBaseUrl = validatedBaseUrl.replace(/\/$/, "");
    } catch (err: any) {
      console.error(`[SSRF BLOCK] Invalid Jira base_url: ${base_url}`, err.message);
      return new Response(JSON.stringify({ error: "Invalid Jira URL. Only official Atlassian cloud hosts are allowed by default." }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
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

    const authHeader = "Basic " + btoa(`${auth_email}:${api_token}`);
    const headers = { Authorization: authHeader, Accept: "application/json" };

    // Build JQL
    let jql = `project=${project_key}`;
    if (!include_resolved) jql += " AND statusCategory != Done";
    if (include_recent) jql += " AND created >= -30d";
    jql += " ORDER BY created DESC";

    let allIssues: any[] = [];
    let startAt = 0;
    const maxResults = 50;
    const fetchSpan = trace.startSpan("fetch_issues", { jql });
    while (allIssues.length < max_issues) {
      const resp = await fetch(`${validatedBaseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}&fields=summary,description,issuetype,status,priority,labels,components,fixVersions,comment`, { headers });
      if (!resp.ok) throw new Error(`Jira API error: ${resp.status} ${await resp.text()}`);
      const data = await resp.json();
      allIssues.push(...data.issues);
      if (data.issues.length < maxResults || allIssues.length >= data.total) break;
      startAt += maxResults;
    }
    fetchSpan.end({ count: allIssues.length });

    allIssues = allIssues.slice(0, max_issues);
    await supabase.from("ingestion_jobs").update({ total_chunks: allIssues.length }).eq("id", jobId);

    const allChunks: any[] = [];
    let chunkIdx = 0;

    for (const issue of allIssues) {
      const markdown = normalizeJiraIssueToMarkdown(issue);
      const pagePath = `jira:${project_key}/${issue.key}`;
      const structuralChunks = chunkMarkdownByHeadings(markdown);

      for (const chunk of structuralChunks) {
        chunkIdx++;
        if (chunkIdx > getRunCap()) throw new Error(`Ingestion cap exceeded (${getRunCap()})`);
        
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
            issue_key: issue.key,
            issue_type: issue.fields.issuetype?.name,
            status: issue.fields.status?.name,
            redaction: assessment.metrics
          },
        });
      }

      if (chunkIdx % 20 === 0) {
        await supabase.from("ingestion_jobs").update({ processed_chunks: allChunks.length }).eq("id", jobId);
      }
    }

    const chunks = allChunks;
    trace.addSpan({ name: "chunk_summary", startTime: Date.now(), endTime: Date.now(), output: { total_chunks: chunks.length } });

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

    // Upsert in batches
    for (let i = 0; i < chunks.length; i += 100) {
      const batch = chunks.slice(i, i + 100);
      await supabase.from("knowledge_chunks").upsert(batch, { onConflict: "pack_id,chunk_id" });
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

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: chunks.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err: any) {
    console.error("Jira ingestion error:", err);

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
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
