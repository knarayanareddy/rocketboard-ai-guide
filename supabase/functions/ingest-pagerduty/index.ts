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

async function pagerDutyAPI(apiKey: string, endpoint: string, params: Record<string, any> = {}) {
  const url = new URL(`https://api.pagerduty.com${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url.toString(), {
    headers: {
      Authorization: `Token token=${apiKey}`,
      "Content-Type": "application/json",
    },
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`PagerDuty API error: ${resp.status} ${text}`);
  }
  return resp.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pack_id, source_id, source_config } = await req.json();
    const {
      api_key,
      service_ids = [],
      include_services = true,
      include_oncall = true,
      include_incidents = true,
      fetch_runbooks = false,
    } = source_config || {};

    if (!api_key) {
      return new Response(JSON.stringify({ error: "Missing PagerDuty API key" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: job } = await supabase.from("ingestion_jobs")
      .insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString() })
      .select().single();
    const jobId = job!.id;

    const chunks: any[] = [];
    let chunkIdx = 0;

    if (include_services) {
      // Fetch services
      const servicesResp = await pagerDutyAPI(api_key, "/services", { limit: 100 });
      let services = servicesResp.services || [];
      
      // Filter by service_ids if provided
      if (service_ids.length > 0) {
        services = services.filter((s: any) => service_ids.includes(s.id));
      }

      for (const service of services) {
        chunkIdx++;
        let content = `# Service: ${service.name}\n\n`;
        content += `**ID**: ${service.id}\n`;
        content += `**Status**: ${service.status}\n`;
        if (service.description) content += `**Description**: ${service.description}\n`;
        content += "\n";

        // Escalation policy
        if (service.escalation_policy) {
          content += `## Escalation Policy\n\n`;
          content += `**Policy**: ${service.escalation_policy.summary || service.escalation_policy.name || "Unknown"}\n`;
        }

        // Integrations
        if (service.integrations?.length) {
          content += `\n## Integrations\n\n`;
          for (const int of service.integrations) {
            content += `- ${int.summary || int.type || "Unknown integration"}\n`;
          }
        }

        // Runbook URL
        if (service.auto_resolve_timeout) {
          content += `\nAuto-resolve timeout: ${service.auto_resolve_timeout / 60} minutes\n`;
        }

        const hash = await sha256(content);
        chunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `pagerduty:${service.name}/overview`,
          start_line: 1,
          end_line: content.split("\n").length,
          content,
          content_hash: hash,
          is_redacted: false,
          pack_id,
          source_id,
          metadata: {
            service_id: service.id,
            service_name: service.name,
            status: service.status,
          },
        });
      }
    }

    if (include_oncall) {
      // Fetch escalation policies and on-call schedules
      try {
        const policiesResp = await pagerDutyAPI(api_key, "/escalation_policies", { limit: 50 });
        const oncallsResp = await pagerDutyAPI(api_key, "/oncalls", { limit: 100 });

        chunkIdx++;
        let content = `# On-Call Structure\n\n`;

        // Escalation policies
        content += `## Escalation Policies\n\n`;
        for (const policy of policiesResp.escalation_policies || []) {
          content += `### ${policy.name}\n`;
          if (policy.description) content += `${policy.description}\n`;
          content += `Escalation rules:\n`;
          for (let i = 0; i < (policy.escalation_rules || []).length; i++) {
            const rule = policy.escalation_rules[i];
            const targets = (rule.targets || []).map((t: any) => t.summary || t.type).join(", ");
            content += `${i + 1}. After ${rule.escalation_delay_in_minutes} min → ${targets}\n`;
          }
          content += "\n";
        }

        // Current on-calls
        content += `## Current On-Call\n\n`;
        const oncallsByPolicy: Record<string, string[]> = {};
        for (const oncall of oncallsResp.oncalls || []) {
          const policyName = oncall.escalation_policy?.summary || "Unknown";
          const userName = oncall.user?.summary || "Unknown";
          if (!oncallsByPolicy[policyName]) oncallsByPolicy[policyName] = [];
          if (!oncallsByPolicy[policyName].includes(userName)) {
            oncallsByPolicy[policyName].push(userName);
          }
        }
        for (const [policy, users] of Object.entries(oncallsByPolicy)) {
          content += `- **${policy}**: ${users.join(", ")}\n`;
        }

        const hash = await sha256(content);
        chunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `pagerduty:oncall/structure`,
          start_line: 1,
          end_line: content.split("\n").length,
          content,
          content_hash: hash,
          is_redacted: false,
          pack_id,
          source_id,
        });
      } catch (err) {
        console.error("Failed to fetch on-call data:", err);
      }
    }

    if (include_incidents) {
      // Fetch recent incidents for pattern analysis
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const incidentsResp = await pagerDutyAPI(api_key, "/incidents", {
          since,
          limit: 100,
          statuses: ["resolved"],
        });

        const incidents = incidentsResp.incidents || [];
        if (incidents.length > 0) {
          chunkIdx++;
          let content = `# Incident Patterns (Last 30 Days)\n\n`;
          content += `**Total incidents**: ${incidents.length}\n\n`;

          // Analyze by service
          const byService: Record<string, number> = {};
          const byUrgency: Record<string, number> = {};
          let totalResolveTime = 0;
          let resolvedCount = 0;

          for (const inc of incidents) {
            const serviceName = inc.service?.summary || "Unknown";
            byService[serviceName] = (byService[serviceName] || 0) + 1;
            byUrgency[inc.urgency || "unknown"] = (byUrgency[inc.urgency || "unknown"] || 0) + 1;

            if (inc.created_at && inc.resolved_at) {
              const created = new Date(inc.created_at).getTime();
              const resolved = new Date(inc.resolved_at).getTime();
              totalResolveTime += (resolved - created) / 60000; // minutes
              resolvedCount++;
            }
          }

          content += `## By Service\n\n`;
          const sortedServices = Object.entries(byService).sort((a, b) => b[1] - a[1]);
          for (const [service, count] of sortedServices.slice(0, 10)) {
            content += `- **${service}**: ${count} incidents\n`;
          }

          content += `\n## By Urgency\n\n`;
          for (const [urgency, count] of Object.entries(byUrgency)) {
            content += `- ${urgency}: ${count}\n`;
          }

          if (resolvedCount > 0) {
            const avgResolveTime = Math.round(totalResolveTime / resolvedCount);
            content += `\n**Average resolution time**: ${avgResolveTime} minutes\n`;
          }

          const hash = await sha256(content);
          chunks.push({
            chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
            path: `pagerduty:incidents/patterns`,
            start_line: 1,
            end_line: content.split("\n").length,
            content,
            content_hash: hash,
            is_redacted: false,
            pack_id,
            source_id,
            metadata: {
              incident_count: incidents.length,
              period_days: 30,
            },
          });
        }
      } catch (err) {
        console.error("Failed to fetch incidents:", err);
      }
    }

    await supabase.from("ingestion_jobs").update({ total_chunks: chunks.length }).eq("id", jobId);

    for (let i = 0; i < chunks.length; i += 100) {
      await supabase.from("knowledge_chunks").upsert(chunks.slice(i, i + 100), { onConflict: "pack_id,chunk_id" });
    }

    await supabase.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);
    await supabase.from("ingestion_jobs").update({
      status: "completed",
      processed_chunks: chunks.length,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: chunks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("PagerDuty ingestion error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
