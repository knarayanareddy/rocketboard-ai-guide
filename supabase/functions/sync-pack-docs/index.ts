import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.6";
import { redactText } from "../_shared/secret-patterns.ts";
import { encodeHex } from "jsr:@std/encoding@1.0.5/hex";
import { readJson } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGINS")?.split(",")[0] || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Extremely naive but deterministic block parser for V1
function parseBlocks(content: string) {
  const blocks: { block_type: string; payload: any }[] = [];
  const lines = content.split('\n');
  
  let inCodeBlock = false;
  let inMermaidBlock = false;
  let codeLang = "";
  let codeBuffer: string[] = [];
  
  let pendingParagraph: string[] = [];
  
  const flushParagraph = () => {
    if (pendingParagraph.length > 0) {
      blocks.push({
        block_type: "paragraph",
        payload: { text: pendingParagraph.join('\n') }
      });
      pendingParagraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Code / Mermaid detection
    if (trimmed.startsWith('```')) {
      if (inCodeBlock || inMermaidBlock) {
        // closing
        blocks.push({
          block_type: inMermaidBlock ? "mermaid" : "code",
          payload: inMermaidBlock 
            ? { diagram: codeBuffer.join('\n') }
            : { lang: codeLang, code: codeBuffer.join('\n') }
        });
        inCodeBlock = false;
        inMermaidBlock = false;
        codeBuffer = [];
      } else {
        flushParagraph();
        const lang = trimmed.slice(3).trim().toLowerCase();
        if (lang === 'mermaid') {
          inMermaidBlock = true;
        } else {
          inCodeBlock = true;
          codeLang = lang;
        }
      }
      continue;
    }

    if (inCodeBlock || inMermaidBlock) {
      codeBuffer.push(line);
      continue;
    }

    // Dividers
    if (trimmed.match(/^(\-{3,}|\*{3,}|\={3,})$/)) {
      flushParagraph();
      blocks.push({ block_type: "divider", payload: {} });
      continue;
    }

    // Headings (## or "1)")
    if (trimmed.match(/^#{1,6}\s/) || trimmed.match(/^[A-Z0-9]+[\)\.]\s+[A-Z]/)) {
      flushParagraph();
      blocks.push({
        block_type: "heading",
        payload: { text: trimmed.replace(/^#{1,6}\s/, '').trim() }
      });
      continue;
    }

    // Checklists
    if (trimmed.startsWith('- [ ] ') || trimmed.startsWith('- [x] ') || trimmed.startsWith('[ ] ') || trimmed.startsWith('[x] ')) {
      flushParagraph();
      // Fast forward to grab the whole checklist
      const items = [];
      while (i < lines.length) {
        const itemLine = lines[i].trim();
        if (itemLine.startsWith('- [ ] ') || itemLine.startsWith('- [x] ') || itemLine.startsWith('[ ] ') || itemLine.startsWith('[x] ')) {
          const checked = itemLine.includes('[x]');
          const text = itemLine.replace(/^[-]?\s*\[[ x]\]\s*/, '').trim();
          items.push({ id: crypto.randomUUID(), text, defaultChecked: checked });
          i++;
        } else {
          i--; // step back to let main loop handle it
          break;
        }
      }
      blocks.push({ block_type: "checklist", payload: { items } });
      continue;
    }

    // Callouts
    if (trimmed.startsWith('NOTE:') || trimmed.startsWith('WARNING:') || trimmed.startsWith('IMPORTANT:') || trimmed.startsWith('> [!')) {
      flushParagraph();
      // Extract variant
      let variant = "info";
      if (trimmed.includes('WARNING') || trimmed.includes('[!WARNING]') || trimmed.includes('[!CAUTION]')) variant = "warning";
      if (trimmed.includes('IMPORTANT') || trimmed.includes('NOTE') || trimmed.includes('[!IMPORTANT]') || trimmed.includes('[!NOTE]')) variant = "tip";
      
      const cleanText = trimmed.replace(/^(> \[\![A-Z]+\]|NOTE:|WARNING:|IMPORTANT:|>)/, '').trim();
      blocks.push({
        block_type: "callout",
        payload: { variant, body: cleanText }
      });
      continue;
    }

    // Just regular text
    if (trimmed !== "") {
      pendingParagraph.push(line); // preserve original spacing
    } else {
      flushParagraph();
    }
  }

  flushParagraph();
  return blocks;
}

// Generate an SEO-friendly slug
function generateSlug(filename: string) {
  return filename
    .toLowerCase()
    .replace(/\.txt|\.md$/, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Clean up title
function formatTitle(filename: string) {
  let title = filename.replace(/\.txt|\.md$/, '');
  title = title.replace(/^[0-9]+_/, ''); // Remove leading numbers "01_"
  title = title.replace(/_/g, ' ');      // Underscores to spaces
  return title;
}

// Determine category
function determineCategory(filename: string) {
  if (filename === 'AGENTS.md') return 'Core';
  
  const match = filename.match(/^([0-9]+)_/);
  if (match) {
    const num = parseInt(match[1]);
    if (num <= 5) return 'Architecture';
    if (num <= 10) return 'RAG & AI';
    if (num <= 12) return 'Security & Ops';
    if (num <= 15) return 'Product Features';
  }
  return 'Technical';
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { pack_id, mode = "execute", source_prefix = "Technical documents/", include_agents = true } = await readJson(req, corsHeaders);

    if (!pack_id) throw new Error("pack_id is required");

    // Supabase client initialization
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: { persistSession: false },
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify JWT
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) throw new Error("Unauthorized");

    // Enforce Author status using RPC (which runs correctly with service_role mapping)
    const { data: hasAccess, error: accessError } = await adminClient.rpc("has_pack_access", {
      _user_id: user.id,
      _pack_id: pack_id,
      _min_level: "author",
    });

    if (accessError || !hasAccess) {
      throw new Error("Forbidden: Must be pack author to sync docs");
    }

    console.log(`[sync-pack-docs] Starting sync for pack: ${pack_id}`);

    // Fetch chunks
    const { data: chunks, error: chunksError } = await adminClient
      .from("knowledge_chunks")
      .select("path, content, start_line")
      .eq("pack_id", pack_id)
      .order("path", { ascending: true })
      .order("start_line", { ascending: true });

    if (chunksError) {
      throw new Error(`Failed to fetch chunks: ${chunksError.message}`);
    }

    // Group and filter
    const files = new Map<string, string[]>();
    for (const chunk of chunks || []) {
      if (chunk.path.startsWith(source_prefix) || (include_agents && chunk.path === 'AGENTS.md')) {
        if (!files.has(chunk.path)) {
          files.set(chunk.path, []);
        }
        files.get(chunk.path)!.push(chunk.content);
      }
    }

    const summary = {
      docs_created: 0,
      docs_updated: 0,
      docs_unchanged: 0,
      files: [] as any[],
    };

    if (mode === "dry_run") {
      for (const [path, contents] of files.entries()) {
        const fullText = contents.join('\n\n');
        const redacted = redactText(fullText);
        summary.files.push({ path, chunks: contents.length, final_chars: redacted.redactedText.length });
      }
      return new Response(JSON.stringify({ status: "dry_run", summary }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Execute Mode: Upsert to pack_docs
    for (const [path, contents] of files.entries()) {
      const dbPath = path;
      const filename = path.split('/').pop() || path;
      const slug = generateSlug(filename);
      const title = formatTitle(filename);
      const category = determineCategory(filename);
      
      // Stitch and redact
      const fullText = contents.join('\n\n');
      const { redactedText } = redactText(fullText);

      // Parse Blocks
      const docBlocks = parseBlocks(redactedText);

      // Hash check
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(redactedText));
      const textHash = encodeHex(hashBuffer);

      // Check existing doc
      const { data: existingDoc } = await adminClient
        .from("pack_docs")
        .select("id, version, summary")
        .eq("pack_id", pack_id)
        .eq("slug", slug)
        .single();

      let docId;
      let newVersion = 1;

      if (existingDoc) {
        // Simple hash check hack - normally we'd store the hash, but for V1 we just compare if the length drastically changed, 
        // wait, we can just always update for now, or use `content_plain` comparison.
        // For absolute safety and simplicity, we just trigger an update.
        docId = existingDoc.id;
        newVersion = existingDoc.version + 1;
        
        const { error: updError } = await adminClient
          .from("pack_docs")
          .update({
            content_plain: redactedText,
            version: newVersion,
            updated_at: new Date().toISOString(),
          })
          .eq("id", docId);
          
        if (updError) throw new Error(`Update doc failed: ${updError.message}`);
        summary.docs_updated++;
      } else {
        const { data: newDoc, error: insError } = await adminClient
          .from("pack_docs")
          .insert({
            pack_id,
            slug,
            title,
            category,
            content_plain: redactedText,
            source_path: dbPath,
            source_type: "repo_import",
            format: "md", // treat everything as MD blocks mostly
            status: "published",
            created_by: user.id,
            owner_user_id: user.id
          })
          .select("id")
          .single();
          
        if (insError) throw new Error(`Insert doc failed: ${insError.message}`);
        docId = newDoc.id;
        summary.docs_created++;
      }

      // Re-create blocks (destructive sync)
      await adminClient.from("pack_doc_blocks").delete().eq("doc_id", docId);
      
      if (docBlocks.length > 0) {
        const blocksToInsert = docBlocks.map((b, i) => ({
          doc_id: docId,
          block_order: i + 1,
          block_type: b.block_type,
          payload: b.payload
        }));
        
        const { error: blkError } = await adminClient.from("pack_doc_blocks").insert(blocksToInsert);
        if (blkError) console.error("Block insert error", blkError);
      }

      summary.files.push({ slug, title, blocks: docBlocks.length });
    }

    // Audit log
    const { error: auditError } = await adminClient.from('lifecycle_audit_events').insert({
      pack_id,
      user_id: user.id,
      action: 'sync_docs',
      status: 'success',
      details: summary
    });
    if (auditError) console.error("Audit fail", auditError);

    return new Response(JSON.stringify({ status: "success", summary }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });

  } catch (error: any) {
    console.error("[sync-pack-docs] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: error.message.includes('Unauthorized') || error.message.includes('Forbidden') ? 403 : 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
