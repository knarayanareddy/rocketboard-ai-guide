import { EvidenceSpan } from "./index.ts";
import { batchRerankWithLLM } from "./reranker.ts";
import {
  extractQualifiedSymbolsFromText,
  normalizeCandidateSymbols,
  SupportedLanguage,
} from "./symbol-dictionary.ts";

export interface DetectiveMetrics {
  detective_enabled: boolean;
  hops_run: number;
  hop0_count: number;
  hop1_added: number;
  hop2_added: number;
  symbols_extracted: number;
  rerank_kept: number;
  time_ms: number;
}

/**
 * Orchestrates the Multi-Hop Detective Retrieval Loop.
 */
export async function runDetectiveRetrieval(
  supabase: any,
  envelope: any,
  initialSpans: EvidenceSpan[],
  queryText: string,
  options: {
    maxHops: number;
    maxSymbols: number;
    maxSpansTotal: number;
    maxTimeMs: number;
  } = {
    maxHops: 1,
    maxSymbols: 12,
    maxSpansTotal: 25,
    maxTimeMs: 5000,
  },
): Promise<{ finalSpans: EvidenceSpan[]; metrics: DetectiveMetrics }> {
  const startTime = Date.now();
  let currentSpans = [...initialSpans];
  let hopsRun = 0;
  let symbolsExtractedCount = 0;
  let hop1AddedCount = 0;
  let hop2AddedCount = 0;

  const packId = envelope.pack?.pack_id;
  const orgId = envelope.pack?.org_id;

  // Hop 0: Use initial spans or fetch them
  if (currentSpans.length === 0 && packId) {
    const { data: hop0Spans, error } = await supabase.rpc("hybrid_search_v2", {
      p_org_id: orgId,
      p_pack_id: packId,
      p_query_text: queryText,
      p_query_embedding: null, // Hop 0 server-side often uses text-only if embedding not provided
      p_match_count: 15,
    });
    if (!error && hop0Spans) {
      currentSpans = hop0Spans.map((s: any, idx: number) => ({
        ...s,
        span_id: `S${idx + 1}`,
      }));
    }
  }

  const hop0Count = currentSpans.length;

  // Hop 1 Loop (currently capped at 1 for v1)
  while (
    hopsRun < options.maxHops && Date.now() - startTime < options.maxTimeMs
  ) {
    hopsRun++;

    // 1. Rerank Hop 0 to find the most relevant context for symbols
    const topK = await batchRerankWithLLM(queryText, currentSpans.slice(0, 15));
    const keptForSymbols = topK.slice(0, 8);

    // 2. Extract symbols
    const symbols = await extractCandidateSymbols(
      keptForSymbols,
      supabase,
      packId,
      options.maxSymbols,
    );
    symbolsExtractedCount = symbols.length;

    if (symbols.length === 0) break;

    // 3. Hop 1 Retrieval (Definitions)
    const { data: hop1Spans, error: hop1Error } = await supabase.rpc(
      "definition_search_v1",
      {
        p_org_id: orgId,
        p_pack_id: packId,
        p_symbols: symbols,
        p_match_count: 15,
      },
    );

    if (hop1Error) {
      console.error("[Detective] Hop 1 RPC error:", hop1Error);
      break;
    }

    if (hop1Spans && hop1Spans.length > 0) {
      const existingChunkIds = new Set(currentSpans.map((s) => s.chunk_id));
      const newSpans = hop1Spans
        .filter((s: any) => !existingChunkIds.has(s.id))
        .map((s: any) => ({
          ...s,
          span_id: "", // Will be renumbered
          chunk_id: s.id,
          text: s.content,
        }));

      hop1AddedCount += newSpans.length;
      currentSpans = [...currentSpans, ...newSpans].slice(
        0,
        options.maxSpansTotal,
      );
    }

    // 4. Hop 2 Retrieval (References - Impact Analysis)
    // Only run if we still have space and time
    if (
      currentSpans.length < options.maxSpansTotal &&
      Date.now() - startTime < options.maxTimeMs
    ) {
      // Pick top 2 symbols for reference expansion to avoid over-fetching
      const topSymbolsForRefs = symbols.slice(0, 2);
      for (const sym of topSymbolsForRefs) {
        const { data: refSpans, error: refError } = await supabase.rpc(
          "find_references_v1",
          {
            p_pack_id: packId,
            p_symbol: sym,
            p_limit: 5,
          },
        );

        if (refError) {
          console.error(`[Detective] Hop 2 RPC error for ${sym}:`, refError);
          continue;
        }

        if (refSpans && refSpans.length > 0) {
          const existingChunkIds = new Set(currentSpans.map((s) => s.chunk_id));
          const newRefSpans = refSpans
            .filter((s: any) => !existingChunkIds.has(s.chunk_id))
            .map((s: any) => ({
              ...s,
              span_id: "",
              text: s.content || "", // RPC might return content or snippet
            }));

          hop2AddedCount += newRefSpans.length;
          currentSpans = [...currentSpans, ...newRefSpans].slice(
            0,
            options.maxSpansTotal,
          );
        }
        if (currentSpans.length >= options.maxSpansTotal) break;
      }
    }

    // Stop if we hit the cap
    if (currentSpans.length >= options.maxSpansTotal) break;
  }

  // Final Rerank of the expanded set
  const finalSpans = await batchRerankWithLLM(queryText, currentSpans);

  // Renumber Spans S1..Sn
  const renumberedSpans = finalSpans.map((s, idx) => ({
    ...s,
    span_id: `S${idx + 1}`,
  }));

  const timeMs = Date.now() - startTime;

  return {
    finalSpans: renumberedSpans,
    metrics: {
      detective_enabled: true,
      hops_run: hopsRun,
      hop0_count: hop0Count,
      hop1_added: hop1AddedCount,
      hop2_added: hop2AddedCount,
      symbols_extracted: symbolsExtractedCount,
      rerank_kept: renumberedSpans.length,
      time_ms: timeMs,
    },
  };
}

/**
 * Deterministic symbol extraction from code chunks.
 */
export async function extractCandidateSymbols(
  spans: EvidenceSpan[],
  supabase: any,
  packId: string,
  maxSymbols: number,
): Promise<string[]> {
  const symbolMap = new Map<string, number>();

  const getLangFromPath = (path: string): SupportedLanguage | undefined => {
    const ext = path.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "ts":
      case "tsx":
        return "typescript";
      case "js":
      case "jsx":
        return "javascript";
      case "py":
        return "python";
      case "go":
        return "go";
      case "java":
        return "java";
      case "rs":
        return "rust";
      default:
        return undefined;
    }
  };

  for (const span of spans) {
    const lang = getLangFromPath(span.path);

    // 1. Metadata preference
    if ((span as any).entity_name) {
      const name = (span as any).entity_name;
      symbolMap.set(name, (symbolMap.get(name) || 0) + 10);
    }

    if (span.chunk_id) {
      const { data: chunk } = await supabase
        .from("knowledge_chunks")
        .select("exported_names, imports")
        .eq("id", span.chunk_id)
        .maybeSingle();

      if (chunk) {
        if (chunk.exported_names) {
          const normalized = normalizeCandidateSymbols(
            chunk.exported_names,
            lang,
          );
          normalized.forEach((name) => {
            symbolMap.set(name, (symbolMap.get(name) || 0) + 5);
          });
        }
        if (chunk.imports) {
          const normalized = normalizeCandidateSymbols(chunk.imports, lang);
          normalized.forEach((name) => {
            symbolMap.set(name, (symbolMap.get(name) || 0) + 3);
          });
        }
      }
    }

    // 2. Dictionary-based extraction from text
    const text = span.text || (span as any).content || "";
    if (text) {
      const extracted = extractQualifiedSymbolsFromText(text, lang);
      extracted.forEach((name) => {
        // Boost weighted slightly for types/classes if they still look like they are being defined
        let weight = 1;
        if (
          text.includes(`class ${name}`) ||
          text.includes(`interface ${name}`) || text.includes(`type ${name}`)
        ) {
          weight = 2;
        }
        symbolMap.set(name, (symbolMap.get(name) || 0) + weight);
      });
    }
  }

  // 3. Sort and Cap
  return Array.from(symbolMap.entries())
    .sort((a, b) => b[1] - a[1]) // highest weight first
    .map((entry) => entry[0])
    .slice(0, maxSymbols);
}
