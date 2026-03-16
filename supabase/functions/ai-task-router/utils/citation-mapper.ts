/**
 * ai-task-router/utils/citation-mapper.ts
 * 
 * Utility to map canonical citations [SOURCE: path:start-end] to UI badges [S1], [S2].
 * This ensures the audit text remains technical while the UI remains readable.
 */

export interface SourceMapEntry {
  badge: string;
  filepath: string;
  start: number;
  end: number;
  chunk_id?: string;
}

export interface CitationMappingResult {
  canonical_response: string;
  display_response: string;
  source_map: SourceMapEntry[];
}

/**
 * Parses canonical citations and generates a display-ready version with a mapping.
 */
export function canonicalizeCitations(originalText: string, spans: any[] = []): CitationMappingResult {
  // Refined safe non-greedy regex
  const citationRegex = /\[SOURCE:\s*([^\]:]+):\s*(\d+)-(\d+)\]/g;
  const sourceMap: SourceMapEntry[] = [];
  const map = new Map<string, string>();
  let badgeCounter = 1;

  const display_response = originalText.replace(citationRegex, (match, path, start, end) => {
    // Normalize filepath whitespace
    const normalizedPath = path.trim();
    const startLine = parseInt(start);
    const endLine = parseInt(end);
    const key = `${normalizedPath}:${startLine}-${endLine}`;
    
    if (!map.has(key)) {
      const badge = `S${badgeCounter++}`;
      map.set(key, badge);
      
      // Attempt to enrich with chunk_id from evidence spans
      const span = spans.find(s => 
        s.path === normalizedPath && 
        (s.start_line <= startLine && s.end_line >= endLine)
      );

      sourceMap.push({ 
        badge, 
        filepath: normalizedPath, 
        start: startLine, 
        end: endLine,
        chunk_id: span?.chunk_id || span?.span_id // Fallback to span_id if chunk_id missing
      });
    }
    return `[${map.get(key)}]`;
  });

  return {
    canonical_response: originalText,
    display_response,
    source_map: sourceMap
  };
}
