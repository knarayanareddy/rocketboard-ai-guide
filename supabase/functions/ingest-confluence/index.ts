import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Reuse secret redaction from ingest-source
const REDACTION_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /(?:aws_secret_access_key|aws_secret|secret_key)\s*[=:]\s*['"]?[A-Za-z0-9/+=]{40}['"]?/gi,
  /['"]?(?:api[_-]?key|apikey|api[_-]?secret|secret[_-]?key)['"]?\s*[:=]\s*['"][^'"]{16,}['"]/gi,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /Bearer\s+[A-Za-z0-9_\-.~+\/]{20,}/g,
  /(?:mongodb|postgres|postgresql|mysql|redis|amqp):\/\/[^\s'"}{]+/gi,
  /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/g,
  /^(?:SECRET|PASSWORD|TOKEN|PRIVATE_KEY|DB_PASS|API_KEY|AUTH_SECRET|ENCRYPTION_KEY|DATABASE_URL|DB_PASSWORD)\s*=\s*\S+/gmi,
  /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  /sk-[A-Za-z0-9]{32,}/g,
  /xox[bpas]-[A-Za-z0-9-]{10,}/g,
  /(?:password|passwd|pwd)\s*[=:]\s*['"]?[^\s'"]{8,}['"]?/gi,
  /(?:sk|pk)_(?:live|test)_[A-Za-z0-9]{20,}/g,
  /(?:secret|token|password|key)\s*[:=]\s*['"]?[A-Za-z0-9+\/=_-]{32,}['"]?/gi,
];

function redactSecrets(text: string): { content: string; isRedacted: boolean } {
  let redacted = text;
  let wasRedacted = false;
  for (const pattern of REDACTION_PATTERNS) {
    pattern.lastIndex = 0;
    const newText = redacted.replace(pattern, "***REDACTED***");
    if (newText !== redacted) wasRedacted = true;
    redacted = newText;
  }
  return { content: redacted, isRedacted: wasRedacted };
}

function chunkWords(text: string, wordCount = 500): { start: number; end: number; text: string }[] {
  const words = text.split(/\s+/);
  const chunks: { start: number; end: number; text: string }[] = [];
  let i = 0;
  let lineEstimate = 1;
  while (i < words.length) {
    const end = Math.min(i + wordCount, words.length);
    const chunk = words.slice(i, end).join(" ");
    const lines = chunk.split("\n").length;
    chunks.push({ start: lineEstimate, end: lineEstimate + lines - 1, text: chunk });
    lineEstimate += lines;
    i = end;
  }
  return chunks;
}

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Convert Confluence storage format HTML to markdown-ish plain text
function htmlToMarkdown(html: string): string {
  let text = html;
  // Headers
  text = text.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "\n# $1\n");
  text = text.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "\n## $1\n");
  text = text.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "\n### $1\n");
  text = text.replace(/<h4[^>]*>(.*?)<\/h4>/gi, "\n#### $1\n");
  // Code blocks
  text = text.replace(/<ac:structured-macro[^>]*ac:name="code"[^>]*>[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>[\s\S]*?<\/ac:structured-macro>/gi, "\n```\n$1\n```\n");
  // Lists
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
  // Paragraphs
  text = text.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
  // Line breaks
  text = text.replace(/<br\s*\/?>/gi, "\n");
  // Bold/italic
  text = text.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
  text = text.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
  // Images
  text = text.replace(/<ac:image[^>]*>[\s\S]*?<ri:attachment ri:filename="([^"]*)"[^>]*\/>[\s\S]*?<\/ac:image>/gi, "[image: $1]");
  text = text.replace(/<img[^>]*alt="([^"]*)"[^>]*\/?>/gi, "[image: $1]");
  text = text.replace(/<img[^>]*\/?>/gi, "[image]");
  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, "");
  // Clean up whitespace
  text = text.replace(/&nbsp;/g, " ");
  text = text.replace(/&lt;/g, "<");
  text = text.replace(/&gt;/g, ">");
  text = text.replace(/&amp;/g, "&");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

async function fetchAllPages(baseUrl: string, spaceKey: string, auth: string): Promise<any[]> {
  const pages: any[] = [];
  let cursor: string | null = null;
  
  while (true) {
    let url = `${baseUrl}/wiki/api/v2/spaces/${spaceKey}/pages?limit=50&body-format=storage`;
    if (cursor) url += `&cursor=${cursor}`;

    const resp = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      // Fallback to v1 API
      if (resp.status === 404) {
        return await fetchAllPagesV1(baseUrl, spaceKey, auth);
      }
      const errText = await resp.text();
      throw new Error(`Confluence API error: ${resp.status} ${errText}`);
    }

    const data = await resp.json();
    pages.push(...(data.results || []));

    // Check for next page
    const nextLink = data._links?.next;
    if (!nextLink) break;

    // Extract cursor from next link
    const cursorMatch = nextLink.match(/cursor=([^&]+)/);
    cursor = cursorMatch ? cursorMatch[1] : null;
    if (!cursor) break;

    // Rate limiting: ~100 req/min → wait 600ms between requests
    await new Promise(r => setTimeout(r, 600));
  }

  return pages;
}

async function fetchAllPagesV1(baseUrl: string, spaceKey: string, auth: string): Promise<any[]> {
  const pages: any[] = [];
  let start = 0;
  const limit = 50;

  while (true) {
    const url = `${baseUrl}/wiki/rest/api/content?spaceKey=${spaceKey}&type=page&limit=${limit}&start=${start}&expand=body.storage,title`;
    
    const resp = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
      },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Confluence v1 API error: ${resp.status} ${errText}`);
    }

    const data = await resp.json();
    const results = data.results || [];
    
    // Map v1 format to v2-like format
    for (const page of results) {
      pages.push({
        id: page.id,
        title: page.title,
        body: {
          storage: {
            value: page.body?.storage?.value || "",
          },
        },
      });
    }

    if (results.length < limit) break;
    start += limit;
    await new Promise(r => setTimeout(r, 600));
  }

  return pages;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { pack_id, source_id, source_config } = await req.json();

    if (!pack_id || !source_id || !source_config) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { base_url, space_key, auth_email, api_token } = source_config;
    if (!base_url || !space_key || !auth_email || !api_token) {
      return new Response(JSON.stringify({ error: "Missing Confluence credentials" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Create ingestion job
    const { data: job, error: jobErr } = await supabase
      .from("ingestion_jobs")
      .insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString() })
      .select()
      .single();
    if (jobErr) throw jobErr;
    const jobId = job.id;

    const cleanUrl = base_url.replace(/\/$/, "");
    const auth = btoa(`${auth_email}:${api_token}`);

    console.log(`[Confluence] Fetching pages from space ${space_key}...`);
    const pages = await fetchAllPages(cleanUrl, space_key, auth);
    console.log(`[Confluence] Found ${pages.length} pages`);

    await supabase.from("ingestion_jobs").update({ total_chunks: pages.length }).eq("id", jobId);

    const allChunks: any[] = [];
    let chunkIdx = 0;

    for (const page of pages) {
      const title = page.title || "Untitled";
      const htmlContent = page.body?.storage?.value || "";
      const markdown = htmlToMarkdown(htmlContent);

      if (!markdown.trim()) continue;

      const wordChunks = chunkWords(markdown);
      for (const chunk of wordChunks) {
        chunkIdx++;
        const { content, isRedacted } = redactSecrets(chunk.text);
        const hash = await sha256(content);

        allChunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `confluence:${space_key}/${title}`,
          start_line: chunk.start,
          end_line: chunk.end,
          content,
          content_hash: hash,
          is_redacted: isRedacted,
        });
      }

      if (allChunks.length % 50 === 0) {
        await supabase.from("ingestion_jobs").update({ processed_chunks: allChunks.length }).eq("id", jobId);
      }
    }

    // Upsert chunks in batches
    const BATCH_SIZE = 100;
    let processed = 0;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE).map((c) => ({
        pack_id,
        source_id,
        ...c,
      }));
      const { error: upsertErr } = await supabase
        .from("knowledge_chunks")
        .upsert(batch, { onConflict: "pack_id,chunk_id" });
      if (upsertErr) console.error("Upsert error:", upsertErr);
      processed += batch.length;
      await supabase.from("ingestion_jobs").update({ processed_chunks: processed }).eq("id", jobId);
    }

    // Update source sync time
    await supabase.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);

    // Mark complete
    await supabase.from("ingestion_jobs").update({
      status: "completed",
      processed_chunks: allChunks.length,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: allChunks.length, pages: pages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Confluence ingestion error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
