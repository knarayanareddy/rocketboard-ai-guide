import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { astChunk } from "../_shared/ast-chunker.ts";
import { getSourceCredential } from "../_shared/credentials.ts";
import { assessChunkRedaction } from "../_shared/secret-patterns.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
import { validateIngestion, checkPackChunkCap, getRunCap } from "../_shared/ingestion-guards.ts";
import { computeContentHash } from "../_shared/hash-utils.ts";
import { processEmbeddingsWithReuse } from "../_shared/embedding-reuse.ts";
import { createTrace, shouldTrace } from "../_shared/telemetry.ts";
import { extractSymbols } from "../_shared/symbol-extractor.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Redaction now handled by centralized secret-patterns.ts

const SUPPORTED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".md", ".json", ".yaml", ".yml",
  ".toml", ".py", ".go", ".rs", ".java", ".rb", ".sh", ".bash",
  ".css", ".scss", ".html", ".sql", ".graphql", ".gql", ".tf",
]);

const SUPPORTED_FILENAMES = new Set([
  "Dockerfile", "Makefile", ".env.example", ".env.sample",
  "docker-compose.yml", "docker-compose.yaml", "Jenkinsfile",
  "README.md", "README", "CONTRIBUTING.md", "SETUP.md",
]);

// Setup-relevant file patterns for metadata tagging
const SETUP_PATTERNS: Record<string, RegExp[]> = {
  dependencies: [
    /^package\.json$/,
    /^requirements\.txt$/,
    /^Gemfile$/,
    /^go\.mod$/,
    /^Cargo\.toml$/,
    /^pom\.xml$/,
    /^build\.gradle$/,
  ],
  configuration: [
    /^\.env/,
    /^config\//,
    /\.config\.(js|ts|json|yaml|yml)$/,
    /settings\.(json|yaml|yml)$/,
  ],
  docker: [
    /^Dockerfile/,
    /^docker-compose/,
    /\.dockerfile$/i,
  ],
  ci_cd: [
    /^\.github\/workflows\//,
    /^\.gitlab-ci\.yml$/,
    /^Jenkinsfile$/,
    /^\.circleci\//,
    /^azure-pipelines\.yml$/,
  ],
  environment: [
    /^Makefile$/,
    /^scripts\//,
    /^bin\//,
    /^README/i,
    /^CONTRIBUTING/i,
    /^SETUP/i,
    /^INSTALL/i,
  ],
  infrastructure: [
    /^terraform\//,
    /^k8s\//,
    /^kubernetes\//,
    /^helm\//,
    /\.tf$/,
  ],
};

function getSetupMetadata(filepath: string): { is_setup_relevant: boolean; setup_category?: string } {
  const basename = filepath.split("/").pop() || "";
  
  for (const [category, patterns] of Object.entries(SETUP_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(filepath) || pattern.test(basename)) {
        return { is_setup_relevant: true, setup_category: category };
      }
    }
  }
  
  return { is_setup_relevant: false };
}

function isSupported(filepath: string): boolean {
  const basename = filepath.split("/").pop() || "";
  if (SUPPORTED_FILENAMES.has(basename)) return true;
  // Check for special filenames that start with common patterns
  if (basename.startsWith("README") || basename.startsWith("CONTRIBUTING") || basename.startsWith("SETUP")) return true;
  const ext = "." + basename.split(".").pop();
  return SUPPORTED_EXTENSIONS.has(ext);
}

// Local redactSecrets removed in favor of assessChunkRedaction()

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

// Local sha256 removed in favor of computeContentHash

async function generateEmbedding(text: string, apiKey: string): Promise<number[] | null> {
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        input: text.replace(/\n/g, " "),
        model: "text-embedding-3-small"
      })
    });
    if (!res.ok) {
      console.error("OpenAI Embedding error:", await res.text());
      return null;
    }
    const data = await res.json();
    return data.data[0].embedding;
  } catch (err) {
    console.error("Embedding generation failed:", err);
    return null;
  }
}

function parseCodeowners(content: string): { pattern: string; owners: string[] }[] {
  const lines = content.split("\n");
  const rules: { pattern: string; owners: string[] }[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      rules.push({ pattern: parts[0], owners: parts.slice(1) });
    }
  }
  return rules;
}

async function fetchGitHubTree(owner: string, repo: string, token?: string): Promise<string[]> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `token ${token}`;

  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers });
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`GitHub API error: ${resp.status} ${err}`);
  }
  const data = await resp.json();
  return (data.tree || [])
    .filter((item: any) => item.type === "blob" && isSupported(item.path))
    .map((item: any) => item.path);
}

async function fetchGitHubFile(owner: string, repo: string, path: string, token?: string): Promise<string> {
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3.raw" };
  if (token) headers.Authorization = `token ${token}`;

  const resp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, { headers });
  if (!resp.ok) return "";
  return await resp.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Hoist variables for catch block accessibility
  let trace: any;
  let jobId: string | undefined;
  let githubToken: string | undefined;
  let source_id: string | undefined;

  try {
    const body = await req.json();
    const { pack_id, source_type, source_uri, document_content, label, source_config, org_id } = body;
    source_id = body.source_id;

    // Initialize Trace (Strategic Sampling)
    trace = createTrace({
      serviceName: 'ingest-source',
      taskType: 'ingestion',
      requestId: crypto.randomUUID(),
      packId: pack_id,
      sourceId: source_id,
      orgId: org_id,
      environment: Deno.env.get("ENVIRONMENT") || "production",
    }, { enabled: shouldTrace() });

    if (!pack_id || !source_id || !source_type) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

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

    // 3. Create ingestion job
    const { data: job, error: jobErr } = await supabase
      .from("ingestion_jobs")
      .insert({ 
        pack_id, 
        source_id, 
        status: "processing", 
        started_at: new Date().toISOString(),
        retry_count: guard.retry_count || 0
      })
      .select()
      .single();
    if (jobErr) throw jobErr;

    if (job) jobId = job.id;
    if (!jobId) throw new Error("Failed to create ingestion job");

    trace.updateMetadata({ jobId });
    let allChunks: { chunk_id: string; path: string; start_line: number; end_line: number; content: string; content_hash: string; is_redacted: boolean; metadata?: Record<string, any>; embedding?: number[]; entity_type?: string; entity_name?: string; signature?: string; imports?: string[]; exported_names?: string[]; ingestion_job_id?: string }[] = [];
    let totalRedactions = 0;
    
    // We will attempt to get an OpenAI API key (or Lovable fallback) for embeddings
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("LOVABLE_API_KEY") || "";

    if (source_type === "github_repo") {
      // Validate source_uri (SSRF Protection)
      let validatedUri: string;
      try {
        validatedUri = parseAndValidateExternalUrl(source_uri, {
          allowAnyHost: true,
          disallowPrivateIPs: true,
          allowHttps: true,
        });
      } catch (err: any) {
        console.error(`[SSRF BLOCK] Invalid GitHub source_uri: ${source_uri}`, err.message);
        return new Response(JSON.stringify({ error: `Invalid Source URI: ${err.message}` }), { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        });
      }

      const match = validatedUri.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (!match) throw new Error("Invalid GitHub repo URL");
      const [, owner, repo] = match;
      
      const fetchTreeSpan = trace.startSpan("fetch_tree", { owner, repo });
      let files: string[] = [];
      try {
        // 1. Try to get token from Vault
        githubToken = await getSourceCredential(supabase, source_id, 'api_token');
        
        // 2. Fallback to Env Var (for system-wide or legacy support)
        if (!githubToken) {
          githubToken = Deno.env.get("GITHUB_TOKEN") || undefined;
        }
        
        files = await fetchGitHubTree(owner, repo.replace(/\.git$/, ""), githubToken || undefined);
        fetchTreeSpan.end({ count: files.length });
      } catch (err: any) {
        fetchTreeSpan.error(err.message);
        throw err;
      }

      // Check for CODEOWNERS
      const codeownersPath = files.find(f => f.endsWith("CODEOWNERS") || f === ".github/CODEOWNERS" || f === "docs/CODEOWNERS");
      if (codeownersPath) {
        const coContent = await fetchGitHubFile(owner, repo.replace(/\.git$/, ""), codeownersPath, githubToken);
        if (coContent) {
          const rules = parseCodeowners(coContent);
          if (rules.length > 0) {
            const ownersToInsert = rules.map(r => ({
              pack_id,
              path_pattern: r.pattern,
              owner_ids: r.owners,
              metadata: { source: codeownersPath }
            }));
            await supabase.from("knowledge_owners").upsert(ownersToInsert, { onConflict: "pack_id,path_pattern" });
            console.log(`[CODEOWNERS] Parsed ${rules.length} rules from ${codeownersPath}`);
          }
        }
      }

      await supabase.from("ingestion_jobs").update({ total_chunks: files.length * 2 }).eq("id", jobId);

      let chunkIdx = 0;
      for (const filepath of files) {
        let fileContent = await fetchGitHubFile(owner, repo.replace(/\.git$/, ""), filepath, githubToken || undefined);
        if (!fileContent) continue;

        const astChunks = await astChunk(fileContent, filepath);
        const repoName = repo.replace(/\.git$/, "");
        const sourceUrl = `https://github.com/${owner}/${repoName}/blob/main/${filepath}`;
        const setupMeta = getSetupMetadata(filepath);

        for (const chunk of astChunks) {
          chunkIdx++;
          // Check per-run cap
          if (chunkIdx > getRunCap()) {
            throw new Error(`Ingestion cap exceeded: maximum of ${getRunCap()} new chunks per run allowed.`);
          }
          const assessment = assessChunkRedaction(chunk.text);
          if (assessment.metrics.secretsFound > 0) {
            totalRedactions += assessment.metrics.secretsFound;
            console.log(`[REDACTION] ${filepath} chunk ${chunkIdx}: ${assessment.metrics.secretsFound} secret(s) found. Action: ${assessment.action}`);
          }

          const hash = await computeContentHash(assessment.contentToStore);
          
          allChunks.push({
            chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
            path: `repo:${owner}/${repoName}/${filepath}`,
            start_line: chunk.metadata.line_start,
            end_line: chunk.metadata.line_end,
            content: assessment.contentToStore,
            content_hash: hash,
            is_redacted: assessment.isRedacted,
            entity_type: chunk.metadata.entity_type,
            entity_name: chunk.metadata.entity_name,
            signature: chunk.metadata.signature,
            imports: chunk.metadata.imports,
            exported_names: chunk.metadata.exported_names || [],
            metadata: { 
              source_url: sourceUrl, 
              ...setupMeta,
              redaction: {
                action: assessment.action,
                secretsFound: assessment.metrics.secretsFound,
                matchedPatterns: assessment.metrics.matchedPatterns,
                redactionRatio: assessment.metrics.redactionRatio,
              }
            },
            embedding: undefined, // placeholder
            ingestion_job_id: jobId,
          });
        }

        if (allChunks.length % 50 === 0) {
          await supabase.from("ingestion_jobs").update({ processed_chunks: allChunks.length }).eq("id", jobId);
        }
      }
      trace.addSpan({ 
        name: "chunk_summary", 
        startTime: Date.now(), 
        endTime: Date.now(), 
        output: { total_chunks: allChunks.length, total_redactions: totalRedactions } 
      });
    } else if (source_type === "document") {
      const text = document_content || "";
      const docLabel = label || source_uri || "untitled";
      const chunks = chunkWords(text);

      let chunkIdx = 0;
      for (const chunk of chunks) {
        chunkIdx++;
        const assessment = assessChunkRedaction(chunk.text);
        if (assessment.metrics.secretsFound > 0) {
          totalRedactions += assessment.metrics.secretsFound;
          console.log(`[REDACTION] doc:${docLabel} chunk ${chunkIdx}: ${assessment.metrics.secretsFound} secret(s) found. Action: ${assessment.action}`);
        }
        const hash = await computeContentHash(assessment.contentToStore);
        
        allChunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `doc:${docLabel}`,
          start_line: chunk.start,
          end_line: chunk.end,
          content: assessment.contentToStore,
          content_hash: hash,
          is_redacted: assessment.isRedacted,
          metadata: { 
            file_type: "document", 
            source_url: source_uri || null,
            redaction: {
              action: assessment.action,
              secretsFound: assessment.metrics.secretsFound,
              matchedPatterns: assessment.metrics.matchedPatterns,
              redactionRatio: assessment.metrics.redactionRatio,
            }
          },
          embedding: undefined,
          ingestion_job_id: jobId,
        });
      }
    } else if (["confluence", "notion", "google_drive", "sharepoint", "jira", "linear", "openapi_spec", "postman_collection", "figma", "slack_channel", "loom_video", "pagerduty"].includes(source_type)) {
      // Route to provider-specific edge function
      const functionNameMap: Record<string, string> = {
        google_drive: "ingest-google-drive",
        openapi_spec: "ingest-openapi",
        postman_collection: "ingest-postman",
        slack_channel: "ingest-slack",
        loom_video: "ingest-loom",
      };
      const functionName = functionNameMap[source_type] || `ingest-${source_type}`;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      
      const routeResp = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ pack_id, source_id, source_config: source_config || {} }),
      });

      if (!routeResp.ok) {
        const errData = await routeResp.json().catch(() => ({ error: "Provider ingestion failed" }));
        throw new Error(errData.error || `${source_type} ingestion failed`);
      }

      const result = await routeResp.json();
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      throw new Error(`Unsupported source_type: ${source_type}`);
    }

    if (totalRedactions > 0) {
      console.log(`[REDACTION SUMMARY] Total redactions for source ${source_id}: ${totalRedactions}`);
    }

    // Log summary for observability
    const redactionSummary = {
      total: allChunks.length,
      clean: allChunks.filter(c => !c.metadata?.redaction || c.metadata.redaction.action === 'clean').length,
      redactedAndIndexed: allChunks.filter(c => c.metadata?.redaction?.action === 'redact_and_index').length,
      excluded: allChunks.filter(c => c.metadata?.redaction?.action === 'exclude').length,
    };
    console.log(`[INGESTION] Redaction summary for source ${source_id}:`, JSON.stringify(redactionSummary));

    // Filter indexable chunks for embedding generation
    const indexableChunks = allChunks.filter(c => !c.is_redacted);
    const excludedChunks = allChunks.filter(c => c.is_redacted);

    const embedSpan = trace.startSpan("process_embeddings", { count: allChunks.length });

    // 1. Handle Embeddings (Reuse + Generation)
    const { reusedCount, generatedCount } = await processEmbeddingsWithReuse(
      supabase,
      pack_id,
      source_id,
      allChunks,
      openAIApiKey
    );
    embedSpan.end({ reusedCount, generatedCount });
    if (generatedCount > 0) trace.enable(); // Strategic: trace if cost incurred

    // Upsert chunks in batches
    const upsertSpan = trace.startSpan("db_upsert_batch", { total: allChunks.length });
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

      if (upsertErr) {
        console.error("Upsert error:", upsertErr);
      }

      processed += batch.length;
      await supabase.from("ingestion_jobs").update({ processed_chunks: processed }).eq("id", jobId);
    }
    upsertSpan.end({ processed });

    // 2. Populate Graph Tables (symbol_definitions, symbol_references)
    const graphSpan = trace.startSpan("populate_graph", { total_chunks: allChunks.length });
    
    // Clean up existing graph rows for this source to ensure no stale data
    await supabase.from("symbol_definitions").delete().eq("source_id", source_id);
    await supabase.from("symbol_references").delete().eq("source_id", source_id);

    const definitionsBatch: any[] = [];
    const referencesBatch: any[] = [];

    for (const chunk of allChunks) {
      if (chunk.is_redacted) continue;

      // a. Definitions
      const symbolsToDefine = new Set<string>();
      if (chunk.entity_name && chunk.entity_name !== "anonymous" && chunk.entity_name !== "file_scope") {
        symbolsToDefine.add(chunk.entity_name);
      }
      if (chunk.exported_names) {
        chunk.exported_names.forEach(name => symbolsToDefine.add(name));
      }

      for (const symbol of symbolsToDefine) {
        definitionsBatch.push({
          pack_id,
          source_id,
          symbol,
          chunk_id: chunk.chunk_id,
          path: chunk.path,
          line_start: chunk.start_line,
          line_end: chunk.end_line
        });
      }

      // b. References
      const lang = chunk.path.split(".").pop() || "typescript";
      const refs = extractSymbols(chunk.content, lang);
      for (const symbol of refs) {
        // Skip referencing the symbol that is defined in the same chunk (prevents self-loops)
        if (symbolsToDefine.has(symbol)) continue;

        referencesBatch.push({
          pack_id,
          source_id,
          symbol,
          from_chunk_id: chunk.chunk_id,
          from_path: chunk.path,
          from_line_start: chunk.start_line,
          from_line_end: chunk.end_line,
          confidence: 1.0 // Simple extraction for now
        });
      }
    }

    // Insert batches
    if (definitionsBatch.length > 0) {
      for (let i = 0; i < definitionsBatch.length; i += BATCH_SIZE) {
        const { error } = await supabase.from("symbol_definitions").upsert(definitionsBatch.slice(i, i + BATCH_SIZE));
        if (error) console.error("[GRAPH] Definitions error:", error);
      }
    }
    if (referencesBatch.length > 0) {
      for (let i = 0; i < referencesBatch.length; i += BATCH_SIZE) {
        const { error } = await supabase.from("symbol_references").upsert(referencesBatch.slice(i, i + BATCH_SIZE));
        if (error) console.error("[GRAPH] References error:", error);
      }
    }
    graphSpan.end({ definitions: definitionsBatch.length, references: referencesBatch.length });

    // Update source last_synced_at
    await supabase.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);

    // Mark job completed
    await supabase.from("ingestion_jobs").update({
      status: "completed",
      processed_chunks: allChunks.length,
      completed_at: new Date().toISOString(),
      metadata: {
        total_chunks: allChunks.length,
        indexable_chunks: indexableChunks.length,
        embeddings_reused_count: reusedCount,
        embeddings_generated_count: generatedCount,
        redaction_summary: redactionSummary,
        trace_id: trace.getTraceId()
      }
    }).eq("id", jobId);

    // Finalize trace
    await trace.flush();

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: allChunks.length, redactions: totalRedactions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Ingestion error:", err);

    // Mark the job as failed so the UI doesn't show a stuck spinner
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

    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
