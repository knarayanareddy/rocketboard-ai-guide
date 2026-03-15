import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function linearGQL(apiKey: string, query: string, variables: Record<string, any> = {}) {
  const resp = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) throw new Error(`Linear API error: ${resp.status}`);
  const data = await resp.json();
  if (data.errors) throw new Error(data.errors[0]?.message || "Linear GraphQL error");
  return data.data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pack_id, source_id, source_config } = await req.json();
    const { api_key, team_id } = source_config || {};

    if (!api_key || !team_id) {
      return new Response(JSON.stringify({ error: "Missing Linear configuration" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: job } = await supabase.from("ingestion_jobs").insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString() }).select().single();
    const jobId = job!.id;

    const MAX_ISSUES = 2000;
    const ISSUES_PER_PAGE = 50;

    // First fetch: team info + projects + first page of issues
    const firstPageData = await linearGQL(api_key, `
      query($teamId: String!, $first: Int!) {
        team(id: $teamId) {
          name
          projects { nodes { name description state } }
          issues(first: $first, orderBy: createdAt) {
            nodes {
              identifier title description
              state { name }
              priority priorityLabel
              labels { nodes { name } }
              project { name }
            }
            pageInfo { hasNextPage endCursor }
          }
        }
      }
    `, { teamId: team_id, first: ISSUES_PER_PAGE });

    const team = firstPageData.team;
    if (!team) throw new Error("Team not found");

    const projects = team.projects?.nodes || [];
    let issues = team.issues?.nodes || [];
    let pageInfo = team.issues?.pageInfo;

    // Paginate through remaining issues
    while (pageInfo?.hasNextPage && issues.length < MAX_ISSUES) {
      const remainingQuota = MAX_ISSUES - issues.length;
      const nextPageData = await linearGQL(api_key, `
        query($teamId: String!, $first: Int!, $after: String!) {
          team(id: $teamId) {
            issues(first: $first, orderBy: createdAt, after: $after) {
              nodes {
                identifier title description
                state { name }
                priority priorityLabel
                labels { nodes { name } }
                project { name }
              }
              pageInfo { hasNextPage endCursor }
            }
          }
        }
      `, { teamId: team_id, first: Math.min(ISSUES_PER_PAGE, remainingQuota), after: pageInfo.endCursor });

      const nextIssues = nextPageData.team?.issues?.nodes || [];
      issues = [...issues, ...nextIssues];
      pageInfo = nextPageData.team?.issues?.pageInfo;
      // Rate limit: Linear API allows 1500 complexity points/min
      await new Promise(r => setTimeout(r, 300));
    }

    await supabase.from("ingestion_jobs").update({ total_chunks: issues.length + projects.length }).eq("id", jobId);

    const chunks: any[] = [];
    let chunkIdx = 0;

    // Projects as chunks
    for (const proj of projects) {
      chunkIdx++;
      let content = `# Project: ${proj.name}\n\n`;
      content += `**State**: ${proj.state || "Unknown"}\n\n`;
      if (proj.description) content += proj.description + "\n";
      const hash = await sha256(content);
      chunks.push({
        chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
        path: `linear:${team.name}/${proj.name}`,
        start_line: 1, end_line: content.split("\n").length,
        content, content_hash: hash, is_redacted: false, pack_id, source_id,
      });
    }

    // Issues as chunks
    for (const issue of issues) {
      chunkIdx++;
      let content = `# ${issue.identifier}: ${issue.title}\n\n`;
      content += `**Status**: ${issue.state?.name || "Unknown"}\n`;
      content += `**Priority**: ${issue.priorityLabel || "None"}\n`;
      if (issue.labels?.nodes?.length) content += `**Labels**: ${issue.labels.nodes.map((l: any) => l.name).join(", ")}\n`;
      if (issue.project?.name) content += `**Project**: ${issue.project.name}\n`;
      content += "\n";
      if (issue.description) content += issue.description + "\n";

      const hash = await sha256(content);
      chunks.push({
        chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
        path: `linear:${team.name}/${issue.project?.name || "_"}/${issue.identifier}`,
        start_line: 1, end_line: content.split("\n").length,
        content, content_hash: hash, is_redacted: false, pack_id, source_id,
      });
    }

    for (let i = 0; i < chunks.length; i += 100) {
      await supabase.from("knowledge_chunks").upsert(chunks.slice(i, i + 100), { onConflict: "pack_id,chunk_id" });
    }

    await supabase.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);
    await supabase.from("ingestion_jobs").update({ status: "completed", processed_chunks: chunks.length, completed_at: new Date().toISOString() }).eq("id", jobId);

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: chunks.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Linear ingestion error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
