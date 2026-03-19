import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function extractRequests(items: any[], folderPath: string = ""): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  for (const item of items) {
    const currentPath = folderPath ? `${folderPath}/${item.name}` : item.name;
    if (item.item) {
      // It's a folder
      results.push(...extractRequests(item.item, currentPath));
    } else if (item.request) {
      const req = item.request;
      const method = typeof req.method === "string" ? req.method : "GET";
      const url = typeof req.url === "string" ? req.url : req.url?.raw || "";

      let content = `## ${method} ${item.name}\n\n`;
      content += `**URL**: ${url}\n`;
      if (req.description) content += `\n${req.description}\n`;

      // Headers (redact auth)
      if (req.header?.length) {
        const safeHeaders = req.header.filter((h: any) => !["authorization", "x-api-key"].includes(h.key?.toLowerCase()));
        if (safeHeaders.length) {
          content += "\nHeaders:\n";
          for (const h of safeHeaders) content += `- ${h.key}: ${h.value}\n`;
        }
      }

      // Body
      if (req.body) {
        if (req.body.mode === "raw" && req.body.raw) {
          const bodyPreview = req.body.raw.length > 500 ? req.body.raw.slice(0, 500) + "..." : req.body.raw;
          content += `\nBody (${req.body.options?.raw?.language || "raw"}):\n\`\`\`\n${bodyPreview}\n\`\`\`\n`;
        }
      }

      // Tests summary
      if (item.event) {
        const testEvents = item.event.filter((e: any) => e.listen === "test");
        if (testEvents.length) {
          content += "\nTests: assertions configured\n";
        }
      }

      results.push({ path: currentPath, content });
    }
  }
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pack_id, source_id, source_config } = await req.json();
    const { collection_json, collection_url, postman_api_key, label = "Postman" } = source_config || {};

    let collection: any;
    if (collection_json) {
      collection = typeof collection_json === "string" ? JSON.parse(collection_json) : collection_json;
    } else if (collection_url && postman_api_key) {
      // Validate collection_url (SSRF Protection)
      let validatedUrl: string;
      try {
        validatedUrl = parseAndValidateExternalUrl(collection_url, {
          allowAnyHost: true,
          disallowPrivateIPs: true,
          allowHttps: true,
        });
      } catch (err: any) {
        console.error(`[SSRF BLOCK] Invalid Postman collection_url: ${collection_url}`, err.message);
        return new Response(JSON.stringify({ error: `Invalid Postman URL: ${err.message}` }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const collId = validatedUrl.replace(/.*\//, "");
      const resp = await fetch(`https://api.getpostman.com/collections/${collId}`, {
        headers: { "X-API-Key": postman_api_key },
      });
      if (!resp.ok) throw new Error(`Postman API error: ${resp.status}`);
      const data = await resp.json();
      collection = data.collection;
    } else {
      throw new Error("No collection data provided");
    }

    // Handle both v2.1 formats
    const info = collection.info || {};
    const collName = info.name || label;
    const items = collection.item || [];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: job } = await supabase.from("ingestion_jobs").insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString() }).select().single();
    const jobId = job!.id;

    const requests = extractRequests(items);
    await supabase.from("ingestion_jobs").update({ total_chunks: requests.length }).eq("id", jobId);

    const chunks: any[] = [];
    let chunkIdx = 0;

    for (const r of requests) {
      chunkIdx++;
      const assessment = assessChunkRedaction(r.content);
      if (assessment.action === "exclude") continue;

      const hash = await sha256(assessment.contentToStore);
      chunks.push({
        chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
        path: `postman:${collName}/${r.path}`,
        start_line: 1, end_line: assessment.contentToStore.split("\n").length,
        content: assessment.contentToStore, content_hash: hash,
        is_redacted: assessment.isRedacted, pack_id, source_id,
        metadata: {
          redaction: {
            action: assessment.action,
            secretsFound: assessment.metrics.secretsFound,
            matchedPatterns: assessment.metrics.matchedPatterns,
            redactionRatio: assessment.metrics.redactionRatio,
          }
        }
      });
    }

    for (let i = 0; i < chunks.length; i += 100) {
      await supabase.from("knowledge_chunks").upsert(chunks.slice(i, i + 100), { onConflict: "pack_id,chunk_id" });
    }

    await supabase.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);
    await supabase.from("ingestion_jobs").update({ status: "completed", processed_chunks: chunks.length, completed_at: new Date().toISOString() }).eq("id", jobId);

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: chunks.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Postman ingestion error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
