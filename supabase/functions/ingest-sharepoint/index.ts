import mammoth from "https://esm.sh/mammoth@1?bundle";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
import { validateIngestion, checkPackChunkCap, getRunCap } from "../_shared/ingestion-guards.ts";
import { computeContentHash } from "../_shared/hash-utils.ts";
import { processEmbeddingsWithReuse } from "../_shared/embedding-reuse.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};


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

// Local sha256 removed

async function getGraphAccessToken(tenantId: string, clientId: string, clientSecret: string): Promise<string> {
  const resp = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Microsoft OAuth error: ${resp.status} ${err}`);
  }

  const data = await resp.json();
  return data.access_token;
}

async function getSiteAndDriveId(siteUrl: string, documentLibrary: string, accessToken: string): Promise<{ siteId: string; driveId: string }> {
  const url = new URL(siteUrl);
  const hostname = url.hostname;
  const sitePath = url.pathname;

  // Get site
  const siteResp = await fetch(`https://graph.microsoft.com/v1.0/sites/${hostname}:${sitePath}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!siteResp.ok) {
    const err = await siteResp.text();
    throw new Error(`Failed to get SharePoint site: ${siteResp.status} ${err}`);
  }
  const site = await siteResp.json();
  const siteId = site.id;

  // Get drives (document libraries)
  const drivesResp = await fetch(`https://graph.microsoft.com/v1.0/sites/${siteId}/drives`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!drivesResp.ok) {
    const err = await drivesResp.text();
    throw new Error(`Failed to get drives: ${drivesResp.status} ${err}`);
  }
  const drivesData = await drivesResp.json();
  
  const drive = (drivesData.value || []).find((d: any) => 
    d.name === documentLibrary || d.name === "Documents"
  ) || drivesData.value?.[0];

  if (!drive) throw new Error(`Document library "${documentLibrary}" not found`);

  return { siteId, driveId: drive.id };
}

async function listFilesRecursive(driveId: string, folderId: string, accessToken: string, parentPath = ""): Promise<any[]> {
  const files: any[] = [];
  let nextLink: string | null = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${folderId}/children?$select=id,name,file,folder,@microsoft.graph.downloadUrl`;

  while (nextLink) {
    const validatedNextLink = parseAndValidateExternalUrl(nextLink, {
      allowAnyHost: true,
      disallowPrivateIPs: true,
      allowHttps: true,
    });
    const resp: Response = await fetch(validatedNextLink, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!resp.ok) {
      // Handle throttling
      if (resp.status === 429) {
        const retryAfter = parseInt(resp.headers.get("Retry-After") || "5");
        console.log(`[SharePoint] Throttled, waiting ${retryAfter}s...`);
        await new Promise(r => setTimeout(r, retryAfter * 1000));
        continue;
      }
      const err = await resp.text();
      throw new Error(`Graph API error: ${resp.status} ${err}`);
    }

    const data: { value?: any[]; "@odata.nextLink"?: string } = await resp.json();

    for (const item of (data.value || [])) {
      const itemPath = parentPath ? `${parentPath}/${item.name}` : item.name;
      
      if (item.folder) {
        const subFiles = await listFilesRecursive(driveId, item.id, accessToken, itemPath);
        files.push(...subFiles);
      } else if (item.file) {
        files.push({
          id: item.id,
          name: item.name,
          path: itemPath,
          mimeType: item.file.mimeType,
          downloadUrl: item["@microsoft.graph.downloadUrl"],
        });
      }
    }

    nextLink = data["@odata.nextLink"] || null;
  }

  return files;
}

async function downloadFileText(downloadUrl: string): Promise<string> {
  const validatedUrl = parseAndValidateExternalUrl(downloadUrl, {
    allowAnyHost: true,
    disallowPrivateIPs: true,
    allowHttps: true,
  });
  const resp = await fetch(validatedUrl);
  if (!resp.ok) return "";
  return await resp.text();
}

const SUPPORTED_EXTENSIONS = new Set([
  ".md", ".txt", ".csv", ".json", ".yaml", ".yml", ".xml",
  ".html", ".htm", ".ts", ".tsx", ".js", ".jsx", ".py",
  ".go", ".rs", ".java", ".rb", ".sh", ".docx",
]);

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isTextFile(name: string, mimeType: string): boolean {
  if (mimeType.startsWith("text/")) return true;
  if (mimeType === "application/json") return true;
  if (mimeType === DOCX_MIME) return true;
  const ext = "." + name.split(".").pop()?.toLowerCase();
  return SUPPORTED_EXTENSIONS.has(ext);
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

    const { site_url, document_library, tenant_id, client_id, client_secret } = source_config;
    if (!site_url || !tenant_id || !client_id || !client_secret) {
      return new Response(JSON.stringify({ error: "Missing SharePoint configuration" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Validate URL (SSRF Protection)
    try {
      parseAndValidateExternalUrl(site_url, {
        allowAnyHost: true,
        disallowPrivateIPs: true,
        allowHttps: true,
      });
    } catch (err: any) {
      console.error(`[SSRF BLOCK] Invalid SharePoint site_url: ${site_url}`, err.message);
      return new Response(JSON.stringify({ error: `Invalid SharePoint URL: ${err.message}` }), { 
        status: 400, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || "";

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

    const { data: job, error: jobErr } = await supabase
      .from("ingestion_jobs")
      .insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString() })
      .select()
      .single();
    if (jobErr) throw jobErr;
    const jobId = job.id;

    console.log(`[SharePoint] Authenticating...`);
    const accessToken = await getGraphAccessToken(tenant_id, client_id, client_secret);

    console.log(`[SharePoint] Getting site and drive info...`);
    const { driveId } = await getSiteAndDriveId(site_url, document_library || "Documents", accessToken);

    console.log(`[SharePoint] Listing files...`);
    const files = await listFilesRecursive(driveId, "root", accessToken);
    console.log(`[SharePoint] Found ${files.length} files`);

    await supabase.from("ingestion_jobs").update({ total_chunks: files.length }).eq("id", jobId);

    const allChunks: any[] = [];
    let chunkIdx = 0;

    for (const file of files) {
      // Only process text-based files for now
      if (!isTextFile(file.name, file.mimeType || "")) continue;
      if (!file.downloadUrl) continue;

      let content = "";
      try {
        if (file.mimeType === DOCX_MIME || file.name.toLowerCase().endsWith(".docx")) {
          // Extract Word document text via mammoth
          const validatedUrl = parseAndValidateExternalUrl(file.downloadUrl, {
            allowAnyHost: true,
            disallowPrivateIPs: true,
            allowHttps: true,
          });
          const arrayBuf = await (await fetch(validatedUrl)).arrayBuffer();
          const result = await mammoth.extractRawText({ arrayBuffer: arrayBuf });
          content = result.value;
        } else {
          content = await downloadFileText(file.downloadUrl);
        }
      } catch (err) {
        console.error(`[SharePoint] Error downloading ${file.path}:`, err);
        continue;
      }

      if (!content.trim()) continue;

      const wordChunks = chunkWords(content);
      for (const chunk of wordChunks) {
        chunkIdx++;
        // Check per-run cap
        if (chunkIdx > getRunCap()) {
          throw new Error(`Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`);
        }
        const assessment = assessChunkRedaction(chunk.text);
        if (assessment.action === "exclude") continue;

        const hash = await computeContentHash(assessment.contentToStore);

        allChunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `sharepoint:${document_library || "Documents"}/${file.path}`,
          start_line: chunk.start,
          end_line: chunk.end,
          content: assessment.contentToStore,
          content_hash: hash,
          is_redacted: assessment.isRedacted,
          metadata: {
            file_name: file.name,
            mime_type: file.mimeType,
            redaction: {
              action: assessment.action,
              secretsFound: assessment.metrics.secretsFound,
              matchedPatterns: assessment.metrics.matchedPatterns,
              redactionRatio: assessment.metrics.redactionRatio,
            }
          }
        });
      }

      if (allChunks.length % 30 === 0) {
        await supabase.from("ingestion_jobs").update({ processed_chunks: allChunks.length }).eq("id", jobId);
      }
    }

    // 4. Handle Embeddings (Reuse + Generation)
    const { reusedCount, generatedCount } = await processEmbeddingsWithReuse(
      supabase,
      pack_id,
      source_id,
      allChunks,
      openAIApiKey
    );

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
      metadata: {
        total_chunks: allChunks.length,
        embeddings_reused_count: reusedCount,
        embeddings_generated_count: generatedCount
      }
    }).eq("id", jobId);

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: allChunks.length, files: files.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("SharePoint ingestion error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
