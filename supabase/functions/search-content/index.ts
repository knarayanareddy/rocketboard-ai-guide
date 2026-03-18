import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const ALLOWED_ORIGINS_ENV = Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:5173,http://localhost:8080";
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_ENV.split(",").map(o => o.trim());

function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  
  return headers;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: getCorsHeaders(origin) });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const { pack_id, query, filters, limit = 10 } = await req.json();

    if (!pack_id || !query || query.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "pack_id and query are required" }),
        { status: 400, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const safeLimit = Math.min(Math.max(limit, 1), 25);
    const tsQuery = query
      .trim()
      .split(/\s+/)
      .filter((w: string) => w.length > 0)
      .map((w: string) => w.replace(/[^\w]/g, ""))
      .filter((w: string) => w.length > 0)
      .join(" & ");

    if (!tsQuery) {
      return new Response(
        JSON.stringify({ modules: [], glossary: [], notes: [], chatHistory: [], sourceChunks: [] }),
        { headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
      );
    }

    const activeFilters = filters && filters.length > 0 ? filters : ["modules", "glossary", "notes", "chatHistory", "sourceChunks"];

    // Use service role for the FTS queries since we verify membership
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify pack membership
    const { data: membership } = await serviceClient
      .from("pack_members")
      .select("id")
      .eq("pack_id", pack_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!membership) {
      return new Response(JSON.stringify({ error: "Not a pack member" }), {
        status: 403,
        headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
      });
    }

    const results: Record<string, unknown[]> = {
      modules: [],
      glossary: [],
      notes: [],
      chatHistory: [],
      sourceChunks: [],
    };

    // Run searches in parallel
    const promises: Promise<void>[] = [];

    if (activeFilters.includes("sourceChunks")) {
      promises.push(
        Promise.resolve(
          serviceClient
            .rpc("search_chunks_fts", undefined, { count: "exact" })
            .then(() => undefined, () => undefined)
        )
      );
      // Direct query approach
      promises.push(
        (async () => {
          const { data } = await serviceClient
            .from("knowledge_chunks")
            .select("chunk_id, path, content")
            .eq("pack_id", pack_id)
            .textSearch("fts", tsQuery, { type: "plain" })
            .limit(safeLimit);
          if (data) {
            results.sourceChunks = data.map((r: any) => ({
              chunkId: r.chunk_id,
              path: r.path,
              snippet: makeSnippet(r.content, query),
            }));
          }
        })()
      );
    }

    if (activeFilters.includes("modules")) {
      promises.push(
        (async () => {
          const { data } = await serviceClient
            .from("generated_modules")
            .select("module_key, title, module_data, description")
            .eq("pack_id", pack_id)
            .eq("status", "published")
            .limit(100);
          if (data) {
            const lowerQ = query.toLowerCase();
            const matched: any[] = [];
            for (const mod of data) {
              const sections = (mod.module_data as any)?.sections || [];
              for (const sec of sections) {
                const heading = sec.heading || "";
                const md = sec.markdown || "";
                if (heading.toLowerCase().includes(lowerQ) || md.toLowerCase().includes(lowerQ)) {
                  matched.push({
                    moduleKey: mod.module_key,
                    moduleTitle: mod.title,
                    sectionId: sec.id || heading,
                    sectionHeading: heading,
                    snippet: makeSnippet(md || heading, query),
                  });
                  if (matched.length >= safeLimit) break;
                }
              }
              // Also check title/description
              if (mod.title?.toLowerCase().includes(lowerQ) || mod.description?.toLowerCase().includes(lowerQ)) {
                if (!matched.some((m: any) => m.moduleKey === mod.module_key)) {
                  matched.push({
                    moduleKey: mod.module_key,
                    moduleTitle: mod.title,
                    sectionId: null,
                    sectionHeading: null,
                    snippet: makeSnippet(mod.description || mod.title, query),
                  });
                }
              }
              if (matched.length >= safeLimit) break;
            }
            results.modules = matched.slice(0, safeLimit);
          }
        })()
      );
    }

    if (activeFilters.includes("glossary")) {
      promises.push(
        (async () => {
          const { data } = await serviceClient
            .from("generated_glossaries")
            .select("glossary_data")
            .eq("pack_id", pack_id)
            .limit(1)
            .order("created_at", { ascending: false });
          if (data && data.length > 0) {
            const terms = (data[0].glossary_data as any[]) || [];
            const lowerQ = query.toLowerCase();
            const matched = terms
              .filter(
                (t: any) =>
                  (t.term || "").toLowerCase().includes(lowerQ) ||
                  (t.definition || "").toLowerCase().includes(lowerQ)
              )
              .slice(0, safeLimit)
              .map((t: any) => ({
                term: t.term,
                definition: t.definition,
                snippet: makeSnippet(t.definition || t.term, query),
              }));
            results.glossary = matched;
          }
        })()
      );
    }

    if (activeFilters.includes("notes")) {
      promises.push(
        (async () => {
          const { data } = await serviceClient
            .from("learner_notes")
            .select("module_id, section_id, content")
            .eq("user_id", userId)
            .eq("pack_id", pack_id)
            .textSearch("content", tsQuery, { type: "plain" })
            .limit(safeLimit);
          if (data) {
            results.notes = data.map((r: any) => ({
              moduleId: r.module_id,
              sectionId: r.section_id,
              snippet: makeSnippet(r.content, query),
            }));
          }
        })()
      );
    }

    if (activeFilters.includes("chatHistory")) {
      promises.push(
        (async () => {
          const { data } = await serviceClient
            .from("chat_messages")
            .select("module_id, content, role")
            .eq("user_id", userId)
            .eq("pack_id", pack_id)
            .textSearch("content", tsQuery, { type: "plain" })
            .limit(safeLimit);
          if (data) {
            results.chatHistory = data.map((r: any) => ({
              moduleId: r.module_id,
              content: r.content,
              role: r.role,
              snippet: makeSnippet(r.content, query),
            }));
          }
        })()
      );
    }

    await Promise.allSettled(promises);

    return new Response(JSON.stringify(results), {
      headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Search error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...getCorsHeaders(origin), "Content-Type": "application/json" } }
    );
  }
});

function makeSnippet(text: string, query: string, contextChars = 80): string {
  if (!text) return "";
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase().split(/\s+/)[0] || query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return text.slice(0, contextChars * 2) + (text.length > contextChars * 2 ? "…" : "");
  const start = Math.max(0, idx - contextChars);
  const end = Math.min(text.length, idx + qLower.length + contextChars);
  let snippet = text.slice(start, end);
  if (start > 0) snippet = "…" + snippet;
  if (end < text.length) snippet = snippet + "…";
  return snippet;
}
