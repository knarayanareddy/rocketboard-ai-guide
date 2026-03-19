import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getSourceCredential } from "../_shared/credentials.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function adfToText(node: any): string {
  if (!node) return "";
  if (typeof node === "string") return node;
  if (node.type === "text") return node.text || "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "heading") {
    const level = node.attrs?.level || 1;
    return "#".repeat(level) + " " + (node.content || []).map(adfToText).join("") + "\n\n";
  }
  if (node.type === "paragraph") return (node.content || []).map(adfToText).join("") + "\n\n";
  if (node.type === "bulletList") return (node.content || []).map((c: any) => "- " + adfToText(c)).join("\n") + "\n";
  if (node.type === "orderedList") return (node.content || []).map((c: any, i: number) => `${i + 1}. ` + adfToText(c)).join("\n") + "\n";
  if (node.type === "listItem") return (node.content || []).map(adfToText).join("").trim();
  if (node.type === "codeBlock") return "```\n" + (node.content || []).map(adfToText).join("") + "\n```\n\n";
  if (node.content) return node.content.map(adfToText).join("");
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pack_id, source_id, source_config } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let { base_url, project_key, auth_email, api_token, max_issues = 200, include_epics = true, include_recent = true, include_comments = false, include_resolved = false } = source_config || {};

    // 1. Fetch api_token from Vault if missing
    if (!api_token) {
      api_token = await getSourceCredential(supabase, source_id, 'api_token');
    }

    if (!base_url || !project_key || !auth_email || !api_token) {
      return new Response(JSON.stringify({ error: "Missing Jira configuration" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: job } = await supabase.from("ingestion_jobs").insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString() }).select().single();
    const jobId = job!.id;

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

    while (allIssues.length < max_issues) {
      const resp = await fetch(`${base_url}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}&startAt=${startAt}&fields=summary,description,issuetype,status,priority,labels,components,fixVersions,comment`, { headers });
      if (!resp.ok) throw new Error(`Jira API error: ${resp.status} ${await resp.text()}`);
      const data = await resp.json();
      allIssues.push(...data.issues);
      if (data.issues.length < maxResults || allIssues.length >= data.total) break;
      startAt += maxResults;
    }

    allIssues = allIssues.slice(0, max_issues);
    await supabase.from("ingestion_jobs").update({ total_chunks: allIssues.length }).eq("id", jobId);

    const chunks: any[] = [];
    let chunkIdx = 0;

    for (const issue of allIssues) {
      chunkIdx++;
      const fields = issue.fields;
      let content = `# ${issue.key}: ${fields.summary}\n\n`;
      content += `**Type**: ${fields.issuetype?.name || "Unknown"}\n`;
      content += `**Status**: ${fields.status?.name || "Unknown"}\n`;
      content += `**Priority**: ${fields.priority?.name || "None"}\n`;
      if (fields.labels?.length) content += `**Labels**: ${fields.labels.join(", ")}\n`;
      if (fields.components?.length) content += `**Components**: ${fields.components.map((c: any) => c.name).join(", ")}\n`;
      content += "\n";

      if (fields.description) {
        content += "## Description\n\n" + adfToText(fields.description) + "\n";
      }

      if (include_comments && fields.comment?.comments?.length) {
        const recentComments = fields.comment.comments.slice(-5);
        content += "## Comments\n\n";
        for (const c of recentComments) {
          content += `**${c.author?.displayName || "Unknown"}**: ${adfToText(c.body)}\n\n`;
        }
      }

      const assessment = assessChunkRedaction(content);
      const hash = await sha256(assessment.contentToStore);
      chunks.push({
        chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
        path: `jira:${project_key}/${issue.key}`,
        start_line: 1,
        end_line: assessment.contentToStore.split("\n").length,
        content: assessment.contentToStore,
        content_hash: hash,
        is_redacted: assessment.isRedacted,
        pack_id,
        source_id,
        metadata: {
          redaction: {
            action: assessment.action,
            secretsFound: assessment.metrics.secretsFound,
            matchedPatterns: assessment.metrics.matchedPatterns,
            redactionRatio: assessment.metrics.redactionRatio,
          }
        }
      });

      if (chunkIdx % 20 === 0) {
        await supabase.from("ingestion_jobs").update({ processed_chunks: chunkIdx }).eq("id", jobId);
      }
    }

    // Upsert in batches
    for (let i = 0; i < chunks.length; i += 100) {
      const batch = chunks.slice(i, i + 100);
      await supabase.from("knowledge_chunks").upsert(batch, { onConflict: "pack_id,chunk_id" });
    }

    await supabase.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);
    await supabase.from("ingestion_jobs").update({ status: "completed", processed_chunks: chunks.length, completed_at: new Date().toISOString() }).eq("id", jobId);

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: chunks.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Jira ingestion error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
