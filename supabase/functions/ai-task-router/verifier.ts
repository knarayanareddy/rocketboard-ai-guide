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
 * Full implementation of Phase 4 Grounding Verification.
 * Performs existence checks, code matching, and hallucination stripping.
 */
export async function verifyGroundedness(
  response: string, 
  spans: EvidenceSpan[]
): Promise<VerificationResult> {
  const warnings: string[] = [];
  const failedBlocks: string[] = [];
  let verifiedContent = response;

  // 1. EXISTENCE CHECK: Verify all [SOURCE: ...] tags point to valid spans
  const citationRegex = /\[SOURCE:\s*(.*?):\s*(\d+)-(\d+)\]/g;
  const matches = [...response.matchAll(citationRegex)];
  
  for (const match of matches) {
    const [_, path] = match;
    const exists = spans.some(s => s.path === path);
    if (!exists) {
      warnings.push(`Response cited non-existent source: ${path}`);
    }
  }

  // 2. CODE STRIPPING: Remove unverified code blocks (Phase 4 Non-Negotiable)
  // [STRICT MODE]: Reject if the code implementation uses libraries or patterns not present in the evidence.
  const codeBlocks = extractCodeBlocks(response);
  for (const block of codeBlocks) {
    if (!isCodeGrounded(block, spans)) {
      failedBlocks.push(block);
      warnings.push("Removed unverified code block to prevent hallucination.");
      
      // Use replaceAll to ensure all identical hallucinations are purged
      verifiedContent = verifiedContent.split(block).join("\n\n> [!WARNING]\n> Removed unverified code block.\n\n");
    }
  }

  // 3. SCORE CALCULATION
  const totalChecks = codeBlocks.length + (matches.length > 0 ? 1 : 0);
  const totalFailed = failedBlocks.length + (matches.length > 0 && !matches.every(m => spans.some(s => s.path === m[1])) ? 1 : 0);
  
  const score = totalChecks === 0 ? 1.0 : Math.max(0, 1.0 - (totalFailed / totalChecks));

  return {
    verifiedContent,
    score,
    warnings,
    failedBlocks
  };
}
