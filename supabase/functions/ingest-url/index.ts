import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function stripHtml(html: string): string {
  // Remove script, style, nav, footer, aside, header elements
  let cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<aside[\s\S]*?<\/aside>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "");

  // Convert headings to markdown
  cleaned = cleaned.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_, level, content) => {
    const prefix = "#".repeat(parseInt(level));
    return `\n${prefix} ${content.replace(/<[^>]+>/g, "").trim()}\n`;
  });

  // Convert lists
  cleaned = cleaned.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  // Convert paragraphs
  cleaned = cleaned.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, "\n$1\n");
  // Convert line breaks
  cleaned = cleaned.replace(/<br\s*\/?>/gi, "\n");
  // Strip remaining tags
  cleaned = cleaned.replace(/<[^>]+>/g, "");
  // Decode entities
  cleaned = cleaned
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
  // Clean whitespace
  cleaned = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return cleaned;
}

function extractTitle(html: string): string {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) return titleMatch[1].trim();
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return h1Match[1].replace(/<[^>]+>/g, "").trim();
  return "";
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const regex = /<a[^>]+href=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const absolute = new URL(match[1], baseUrl).href;
      links.push(absolute);
    } catch {
      // invalid URL
    }
  }
  return [...new Set(links)];
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

async function fetchPage(url: string, policy: any): Promise<{ content: string; contentType: string; html: string }> {
  // 1. Validate URL before every fetch
  const validatedUrl = parseAndValidateExternalUrl(url, policy);

  const resp = await fetch(validatedUrl, {
    headers: { "User-Agent": "RocketBoard-Bot/1.0 (knowledge ingestion)" },
    redirect: "follow",
  });
  if (!resp.ok) throw new Error(`Failed to fetch ${url}: ${resp.status}`);
  const contentType = resp.headers.get("content-type") || "";
  const html = await resp.text();

  if (contentType.includes("text/html")) {
    let content = stripHtml(html);

    // If content is suspiciously short (likely a JS-rendered SPA), fall back to Jina Reader
    if (content.length < 200) {
      try {
        console.log(`[URL] Content too short (${content.length} chars), trying Jina Reader for ${url}`);
        // IMPORTANT: The embedded URL in r.jina.ai must be the VALIDATED one
        const jinaResp = await fetch(`https://r.jina.ai/${validatedUrl}`, {
          headers: { "Accept": "text/plain", "User-Agent": "RocketBoard-Bot/1.0" },
          redirect: "follow",
        });
        if (jinaResp.ok) {
          const jinaContent = await jinaResp.text();
          if (jinaContent.length > content.length) {
            console.log(`[URL] Jina Reader returned ${jinaContent.length} chars`);
            return { content: jinaContent, contentType: "html", html };
          }
        }
      } catch (jinaErr) {
        console.log(`[URL] Jina Reader fallback failed:`, jinaErr);
      }
    }

    return { content, contentType: "html", html };
  }
  return { content: html, contentType: contentType.split(";")[0], html };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      pack_id,
      source_id,
      url: startUrl,
      crawl_mode = "single",
      max_depth = 2,
      max_pages = 50,
      follow_internal_only = true,
      include_pdfs = false,
      label,
    } = await req.json();

    if (!pack_id || !source_id || !startUrl) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // Public and restricted URL policy
    const urlPolicy = {
      allowAnyHost: true,
      disallowPrivateIPs: true,
      allowHttp: Deno.env.get("ALLOW_INSECURE_URL_INGESTION") === "true",
      allowHttps: true,
    };

    let validatedStartUrl: string;
    try {
      validatedStartUrl = parseAndValidateExternalUrl(startUrl, urlPolicy);
    } catch (err: any) {
      return new Response(JSON.stringify({ error: `Invalid URL: ${err.message}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrlObj = new URL(validatedStartUrl);
    const baseDomain = baseUrlObj.hostname;
    const visited = new Set<string>();
    const queue: { url: string; depth: number }[] = [{ url: validatedStartUrl, depth: 0 }];
    const allChunks: any[] = [];
    let chunkIdx = 0;
    let pagesProcessed = 0;

    while (queue.length > 0 && pagesProcessed < max_pages) {
      const current = queue.shift()!;
      if (visited.has(current.url)) continue;
      visited.add(current.url);

      try {
        const { content, contentType, html } = await fetchPage(current.url, urlPolicy);
        pagesProcessed++;

        const title = contentType === "html" ? extractTitle(html) : "";
        const pageContent = title ? `# ${title}\n\n${content}` : content;
        const urlPath = new URL(current.url).pathname;

        // Chunk the content
        const chunks = chunkWords(pageContent);
        for (const chunk of chunks) {
          chunkIdx++;
          const assessment = assessChunkRedaction(chunk.text);
          if (assessment.action === "exclude") continue;

          const hash = await sha256(assessment.contentToStore);
          allChunks.push({
            chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
            path: `url:${baseDomain}${urlPath}`,
            start_line: chunk.start,
            end_line: chunk.end,
            content: assessment.contentToStore,
            content_hash: hash,
            is_redacted: assessment.isRedacted,
            metadata: { 
              source_url: current.url, 
              page_title: title,
              redaction: {
                action: assessment.action,
                secretsFound: assessment.metrics.secretsFound,
                matchedPatterns: assessment.metrics.matchedPatterns,
                redactionRatio: assessment.metrics.redactionRatio,
              }
            },
          });
        }

        // In crawl mode, extract and queue links
        if (crawl_mode === "crawl" && current.depth < max_depth && contentType === "html") {
          const links = extractLinks(html, current.url);
          for (const link of links) {
            try {
              const linkUrl = new URL(link);
              // Skip fragments, mailto, etc.
              if (!linkUrl.protocol.startsWith("http")) continue;
              // Follow internal only
              if (follow_internal_only && linkUrl.hostname !== baseDomain) continue;
              // Skip non-html unless includePdfs
              if (linkUrl.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|css|js|woff|ttf|eot)$/i)) continue;
              if (!include_pdfs && linkUrl.pathname.endsWith(".pdf")) continue;

              if (visited.has(linkUrl.href)) continue;

              // Validate link before queuing
              try {
                parseAndValidateExternalUrl(linkUrl.href, urlPolicy);
                queue.push({ url: linkUrl.href, depth: current.depth + 1 });
              } catch (policyErr: any) {
                console.warn(`[SSRF SKIP] Link ${linkUrl.href} violated policy: ${policyErr.message}`);
              }
            } catch {
              // invalid URL
            }
          }
        }

        // Update progress
        await supabase.from("ingestion_jobs").update({
          processed_chunks: pagesProcessed,
          total_chunks: pagesProcessed + queue.length,
        }).eq("id", jobId);

        // Polite delay for crawl mode
        if (crawl_mode === "crawl" && queue.length > 0) {
          await new Promise((r) => setTimeout(r, 500));
        }
      } catch (err) {
        console.error(`Failed to fetch ${current.url}:`, err);
      }
    }

    // Upsert chunks
    const BATCH_SIZE = 100;
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
    }

    // Update source
    await supabase.from("pack_sources").update({
      last_synced_at: new Date().toISOString(),
    }).eq("id", source_id);

    // Mark job completed
    await supabase.from("ingestion_jobs").update({
      status: "completed",
      processed_chunks: allChunks.length,
      total_chunks: allChunks.length,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        pages: pagesProcessed,
        chunks: allChunks.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("URL ingestion error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
