import { EvidenceSpan } from "./index.ts";

/**
 * Advanced grounding verification for RAG responses.
 * Implements Phase 4 of the Zero-Hallucination migration.
 */

export interface VerificationResult {
  verifiedContent: string;
  score: number; // 0.0 to 1.0
  warnings: string[];
  failedBlocks: string[];
}

/**
 * Extracts code blocks from markdown text.
 */
function extractCodeBlocks(text: string): string[] {
  const regex = /```[\s\S]*?```/g;
  return text.match(regex) || [];
}

/**
 * Checks if a code block is grounded in the provided evidence spans.
 * Per Phase 4: This performs sub-string matching and fuzzy verification.
 */
function isCodeGrounded(block: string, spans: EvidenceSpan[]): boolean {
  // Strip fences
  const lines = block.split("\n");
  if (lines.length < 2) return true; // Empty block
  const content = lines.slice(1, -1).join("\n").trim();
  
  if (!content) return true;

  // Check if this exact content exists in any of the evidence spans
  for (const span of spans) {
    if (span.text.includes(content)) return true;
    
    // Fuzzy/partial match for larger blocks (allow small changes like comments)
    // For now, strict line-by-line containment check for robustness
    const contentLines = content.split("\n").map(l => l.trim()).filter(l => l.length > 5);
    if (contentLines.length === 0) continue;
    
    let matchedLines = 0;
    for (const line of contentLines) {
      if (span.text.includes(line)) matchedLines++;
    }
    
    if (matchedLines / contentLines.length > 0.8) return true; 
  }

  return false;
}

/**
 * Segments markdown into semantic claims and enforces citation validity.
 * metrics: claims_total, claims_stripped, strip_rate.
 */
export async function verifyClaims(text: string, spans: EvidenceSpan[]) {
  const claimUnits = text.split(/(\n- |\n\d+\. |(?<=[.!?])\s+)/);
  let claims_total = 0;
  let claims_stripped = 0;

  const verifiedParts = claimUnits.map(part => {
    if (/^(\n- |\n\d+\. |\s+)$/.test(part)) return part;

    claims_total++;
    const citations = extractCitations(part); // Regex: [SOURCE: ...]
    const isTechnical = /[a-zA-Z0-9_]{3,}\.[a-zA-Z0-9_]{3,}|function|class|const|var/.test(part);
    
    const validCitations = citations.filter(cit => {
       const span = spans.find(s => {
         const sPath = s.path === cit.path;
         const sStart = (s.start_line ?? s.line_start ?? 0) <= cit.start;
         const sEnd = (s.end_line ?? s.line_end ?? 0) >= cit.end;
         return sPath && sStart && sEnd;
       });
       return !!span;
    });

    // Invariant: Invalid citation => remove ENTIRE claim unit
    if ((citations.length > 0 && validCitations.length !== citations.length) || (!citations.length && isTechnical)) {
      claims_stripped++;
      return null;
    }
    return part;
  });

  const strip_rate = claims_total > 0 ? claims_stripped / claims_total : 0;
  if (strip_rate > 0.30) {
    throw { status: 422, error_code: "grounding_failed", message: `Strip rate too high (${Math.round(strip_rate*100)}%). Triggering retry.` };
  }

  const rawJoined = verifiedParts.filter(Boolean).join("");
  const verifiedText = cleanupDanglingListMarkers(rawJoined);
  
  return { verifiedText, claims_total, claims_stripped, strip_rate };
}

function cleanupDanglingListMarkers(md: string): string {
  return md
    .replace(/\n- (?=\n|$)/g, "") // Remove empty bullets
    .replace(/\n\d+\. (?=\n|$)/g, "") // Remove empty numbers
    .replace(/\n{3,}/g, "\n\n"); // Collapse 3+ lines to 2
}

function extractCitations(text: string): { path: string; start: number; end: number }[] {
  const regex = /\[SOURCE:\s*([^\]:]+):\s*(\d+)-(\d+)\]/g;
  const citations = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    citations.push({
      path: match[1].trim(),
      start: parseInt(match[2]),
      end: parseInt(match[3])
    });
  }
  return citations;
}

export async function verifyGroundedness(
  response: string, 
  spans: EvidenceSpan[]
): Promise<VerificationResult> {
  // Legacy function - we can either keep it or redirect it to verifyClaims
  const { verifiedText, claims_stripped } = await verifyClaims(response, spans);
  return {
    verifiedContent: verifiedText,
    score: claims_stripped === 0 ? 1.0 : 0.5, // Rough legacy mapping
    warnings: claims_stripped > 0 ? ["Some unverified claims were removed."] : [],
    failedBlocks: []
  };
}
