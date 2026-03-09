import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const NOTION_VERSION = "2022-06-28";

const REDACTION_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /['"]?(?:api[_-]?key|apikey|api[_-]?secret|secret[_-]?key)['"]?\s*[:=]\s*['"][^'"]{16,}['"]/gi,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /(?:mongodb|postgres|postgresql|mysql|redis|amqp):\/\/[^\s'"}{]+/gi,
  /-----BEGIN\s+(?:RSA\s+|EC\s+|DSA\s+|OPENSSH\s+)?PRIVATE\s+KEY-----/g,
  /gh[pousr]_[A-Za-z0-9_]{36,}/g,
  /sk-[A-Za-z0-9]{32,}/g,
  /xox[bpas]-[A-Za-z0-9-]{10,}/g,
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
  const words = text.split(/\s+/).filter(Boolean);
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

// Convert Notion blocks to markdown
function blocksToMarkdown(blocks: any[]): string {
  const parts: string[] = [];
  
  for (const block of blocks) {
    const type = block.type;
    
    switch (type) {
      case "paragraph":
        parts.push(richTextToPlain(block.paragraph?.rich_text) + "\n");
        break;
      case "heading_1":
        parts.push(`# ${richTextToPlain(block.heading_1?.rich_text)}\n`);
        break;
      case "heading_2":
        parts.push(`## ${richTextToPlain(block.heading_2?.rich_text)}\n`);
        break;
      case "heading_3":
        parts.push(`### ${richTextToPlain(block.heading_3?.rich_text)}\n`);
        break;
      case "bulleted_list_item":
        parts.push(`- ${richTextToPlain(block.bulleted_list_item?.rich_text)}\n`);
        break;
      case "numbered_list_item":
        parts.push(`1. ${richTextToPlain(block.numbered_list_item?.rich_text)}\n`);
        break;
      case "to_do":
        const checked = block.to_do?.checked ? "☑" : "☐";
        parts.push(`${checked} ${richTextToPlain(block.to_do?.rich_text)}\n`);
        break;
      case "code":
        const lang = block.code?.language || "";
        parts.push(`\`\`\`${lang}\n${richTextToPlain(block.code?.rich_text)}\n\`\`\`\n`);
        break;
      case "quote":
        parts.push(`> ${richTextToPlain(block.quote?.rich_text)}\n`);
        break;
      case "callout":
        const icon = block.callout?.icon?.emoji || "💡";
        parts.push(`${icon} ${richTextToPlain(block.callout?.rich_text)}\n`);
        break;
      case "divider":
        parts.push("---\n");
        break;
      case "toggle":
        parts.push(`▸ ${richTextToPlain(block.toggle?.rich_text)}\n`);
        break;
      case "image":
        const caption = block.image?.caption ? richTextToPlain(block.image.caption) : "image";
        parts.push(`[image: ${caption}]\n`);
        break;
      case "bookmark":
        const url = block.bookmark?.url || "";
        parts.push(`[link: ${url}]\n`);
        break;
      case "table":
        // Tables handled by their rows
        break;
      case "table_row":
        const cells = (block.table_row?.cells || []).map((cell: any) => richTextToPlain(cell));
        parts.push(`| ${cells.join(" | ")} |\n`);
        break;
      default:
        // Skip unsupported blocks
        break;
    }
  }
  
  return parts.join("").trim();
}

function richTextToPlain(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) return "";
  return richText.map((rt: any) => {
    let text = rt.plain_text || "";
    if (rt.annotations?.bold) text = `**${text}**`;
    if (rt.annotations?.italic) text = `*${text}*`;
    if (rt.annotations?.code) text = `\`${text}\``;
    if (rt.annotations?.strikethrough) text = `~~${text}~~`;
    return text;
  }).join("");
}

function getPageTitle(page: any): string {
  const titleProp = page.properties?.title || page.properties?.Name;
  if (titleProp?.title) {
    return richTextToPlain(titleProp.title) || "Untitled";
  }
  return "Untitled";
}

async function notionFetch(url: string, token: string, method = "GET", body?: any): Promise<any> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json",
  };

  const resp = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Notion API error: ${resp.status} ${err}`);
  }

  return resp.json();
}

async function fetchPageBlocks(pageId: string, token: string): Promise<any[]> {
  const allBlocks: any[] = [];
  let cursor: string | undefined;

  while (true) {
    let url = `https://api.notion.com/v1/blocks/${pageId}/children?page_size=100`;
    if (cursor) url += `&start_cursor=${cursor}`;

    const data = await notionFetch(url, token);
    allBlocks.push(...(data.results || []));

    if (!data.has_more) break;
    cursor = data.next_cursor;
    
    // Rate limiting: 3 req/s
    await new Promise(r => setTimeout(r, 350));
  }

  // Recursively fetch child blocks for blocks that have children
  for (const block of allBlocks) {
    if (block.has_children && block.type !== "child_page" && block.type !== "child_database") {
      const children = await fetchPageBlocks(block.id, token);
      allBlocks.push(...children);
    }
  }

  return allBlocks;
}

async function searchAllPages(token: string): Promise<any[]> {
  const pages: any[] = [];
  let cursor: string | undefined;

  while (true) {
    const body: any = {
      page_size: 100,
      filter: { property: "object", value: "page" },
    };
    if (cursor) body.start_cursor = cursor;

    const data = await notionFetch("https://api.notion.com/v1/search", token, "POST", body);
    pages.push(...(data.results || []));

    if (!data.has_more) break;
    cursor = data.next_cursor;
    await new Promise(r => setTimeout(r, 350));
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

    const { integration_token, root_page_id } = source_config;
    if (!integration_token) {
      return new Response(JSON.stringify({ error: "Missing Notion integration token" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: job, error: jobErr } = await supabase
      .from("ingestion_jobs")
      .insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString() })
      .select()
      .single();
    if (jobErr) throw jobErr;
    const jobId = job.id;

    // Get pages
    let pages: any[];
    if (root_page_id) {
      // Fetch child pages from root
      console.log(`[Notion] Fetching children of page ${root_page_id}...`);
      const blocks = await fetchPageBlocks(root_page_id, integration_token);
      const childPages = blocks.filter((b: any) => b.type === "child_page");
      
      // Also process the root page itself
      const rootPage = await notionFetch(`https://api.notion.com/v1/pages/${root_page_id}`, integration_token);
      pages = [rootPage, ...await Promise.all(childPages.map((cp: any) =>
        notionFetch(`https://api.notion.com/v1/pages/${cp.id}`, integration_token)
      ))];
    } else {
      console.log("[Notion] Searching all accessible pages...");
      pages = await searchAllPages(integration_token);
    }

    console.log(`[Notion] Found ${pages.length} pages`);
    await supabase.from("ingestion_jobs").update({ total_chunks: pages.length }).eq("id", jobId);

    const allChunks: any[] = [];
    let chunkIdx = 0;

    for (const page of pages) {
      const title = getPageTitle(page);
      
      // Fetch page blocks
      const blocks = await fetchPageBlocks(page.id, integration_token);
      const markdown = blocksToMarkdown(blocks);

      if (!markdown.trim()) continue;

      const wordChunks = chunkWords(markdown);
      for (const chunk of wordChunks) {
        chunkIdx++;
        const { content, isRedacted } = redactSecrets(chunk.text);
        const hash = await sha256(content);

        allChunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `notion:${title}`,
          start_line: chunk.start,
          end_line: chunk.end,
          content,
          content_hash: hash,
          is_redacted: isRedacted,
        });
      }

      if (allChunks.length % 30 === 0) {
        await supabase.from("ingestion_jobs").update({ processed_chunks: allChunks.length }).eq("id", jobId);
      }
    }

    // Upsert chunks
    const BATCH_SIZE = 100;
    let processed = 0;
    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      const batch = allChunks.slice(i, i + BATCH_SIZE).map((c) => ({
        pack_id, source_id, ...c,
      }));
      const { error: upsertErr } = await supabase
        .from("knowledge_chunks")
        .upsert(batch, { onConflict: "pack_id,chunk_id" });
      if (upsertErr) console.error("Upsert error:", upsertErr);
      processed += batch.length;
      await supabase.from("ingestion_jobs").update({ processed_chunks: processed }).eq("id", jobId);
    }

    await supabase.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);

    await supabase.from("ingestion_jobs").update({
      status: "completed",
      processed_chunks: allChunks.length,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: allChunks.length, pages: pages.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Notion ingestion error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
