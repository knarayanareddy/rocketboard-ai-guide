import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as yaml from "https://esm.sh/js-yaml@4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function summarizeSchema(schema: any, depth = 0): string {
  if (!schema || depth > 3) return "object";
  if (schema.$ref) return schema.$ref.split("/").pop() || "ref";
  if (schema.type === "array") return `array of ${summarizeSchema(schema.items, depth + 1)}`;
  if (schema.type === "object" && schema.properties) {
    const props = Object.entries(schema.properties).slice(0, 10).map(([k, v]: [string, any]) => `${k}: ${v.type || summarizeSchema(v, depth + 1)}`);
    return `{ ${props.join(", ")} }`;
  }
  return schema.type || "any";
}

function parseSpec(raw: string): any {
  // Try YAML first — js-yaml also handles JSON since JSON is valid YAML
  try { return yaml.load(raw); } catch {}
  // Strict JSON fallback
  try { return JSON.parse(raw); } catch {}
  throw new Error("Could not parse spec. Please provide valid JSON or YAML.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pack_id, source_id, source_config } = await req.json();
    const { spec_url, spec_content, label = "API" } = source_config || {};

    let specText = spec_content;
    if (spec_url && !specText) {
      const resp = await fetch(spec_url);
      if (!resp.ok) throw new Error(`Failed to fetch spec: ${resp.status}`);
      specText = await resp.text();
    }
    if (!specText) throw new Error("No spec provided");

    const spec = parseSpec(specText);
    const isSwagger = spec.swagger?.startsWith("2.");
    const title = spec.info?.title || label;
    const version = spec.info?.version || "";
    const basePath = isSwagger ? (spec.basePath || "") : "";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: job } = await supabase.from("ingestion_jobs").insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString() }).select().single();
    const jobId = job!.id;

    // Group endpoints by tag
    const taggedEndpoints: Record<string, string[]> = {};
    const paths = spec.paths || {};

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, op] of Object.entries(methods as Record<string, any>)) {
        if (["get", "post", "put", "patch", "delete", "head", "options"].indexOf(method) === -1) continue;
        const tags = op.tags || ["untagged"];
        const fullPath = basePath + path;

        let desc = `**${method.toUpperCase()} ${fullPath}**`;
        if (op.summary) desc += ` — ${op.summary}`;
        desc += "\n";
        if (op.description) desc += `${op.description}\n`;

        // Parameters
        const params = op.parameters || [];
        if (params.length) {
          desc += "\nParameters:\n";
          for (const p of params) {
            desc += `- ${p.name} (${p.in}, ${p.required ? "required" : "optional"}): ${p.description || p.schema?.type || "any"}\n`;
          }
        }

        // Request body (OpenAPI 3)
        if (op.requestBody) {
          const content = op.requestBody.content;
          const jsonSchema = content?.["application/json"]?.schema;
          if (jsonSchema) desc += `\nRequest body: ${summarizeSchema(jsonSchema)}\n`;
        }

        // Responses
        const responses = op.responses || {};
        const successResp = responses["200"] || responses["201"] || responses["204"];
        if (successResp) {
          desc += `\nSuccess response: ${successResp.description || "OK"}`;
          const schema = successResp.content?.["application/json"]?.schema || successResp.schema;
          if (schema) desc += ` — ${summarizeSchema(schema)}`;
          desc += "\n";
        }

        // Security
        if (op.security?.length) {
          const secNames = op.security.flatMap((s: any) => Object.keys(s));
          desc += `\nAuth: ${secNames.join(", ")}\n`;
        }

        for (const tag of tags) {
          if (!taggedEndpoints[tag]) taggedEndpoints[tag] = [];
          taggedEndpoints[tag].push(desc);
        }
      }
    }

    const chunks: any[] = [];
    let chunkIdx = 0;

    // API overview chunk
    chunkIdx++;
    let overview = `# ${title} v${version}\n\n`;
    if (spec.info?.description) overview += spec.info.description + "\n\n";
    overview += `Tags: ${Object.keys(taggedEndpoints).join(", ")}\n`;
    overview += `Total endpoints: ${Object.values(taggedEndpoints).flat().length}\n`;
    const overviewHash = await sha256(overview);
    chunks.push({
      chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
      path: `openapi:${title}/overview`,
      start_line: 1, end_line: overview.split("\n").length,
      content: overview, content_hash: overviewHash, is_redacted: false, pack_id, source_id,
    });

    // Per-tag chunks
    for (const [tag, endpoints] of Object.entries(taggedEndpoints)) {
      chunkIdx++;
      const content = `# ${title} — ${tag}\n\n${endpoints.join("\n---\n\n")}`;
      const hash = await sha256(content);
      chunks.push({
        chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
        path: `openapi:${title}/${tag}`,
        start_line: 1, end_line: content.split("\n").length,
        content, content_hash: hash, is_redacted: false, pack_id, source_id,
      });
    }

    await supabase.from("ingestion_jobs").update({ total_chunks: chunks.length }).eq("id", jobId);

    for (let i = 0; i < chunks.length; i += 100) {
      await supabase.from("knowledge_chunks").upsert(chunks.slice(i, i + 100), { onConflict: "pack_id,chunk_id" });
    }

    await supabase.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);
    await supabase.from("ingestion_jobs").update({ status: "completed", processed_chunks: chunks.length, completed_at: new Date().toISOString() }).eq("id", jobId);

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: chunks.length, endpoints: Object.values(taggedEndpoints).flat().length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("OpenAPI ingestion error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
