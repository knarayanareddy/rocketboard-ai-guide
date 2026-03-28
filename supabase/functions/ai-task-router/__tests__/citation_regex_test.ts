import { assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";

// The exact regex used in the ai-task-router
const CITATION_REGEX = /\[SOURCE:\s*(.+?)(?=:\d+-\d+\])\s*:(\d+)-(\d+)\]/g;

function extractCitations(text: string) {
  const citations = [];
  let match;
  // Reset regex index for global matches
  CITATION_REGEX.lastIndex = 0;
  while ((match = CITATION_REGEX.exec(text)) !== null) {
    citations.push({
      path: match[1].trim(),
      start: parseInt(match[2]),
      end: parseInt(match[3]),
    });
  }
  return citations;
}

Deno.test("Part B: Regression Test - Multi-citation parsing", () => {
  const input =
    "- Bullet text [SOURCE: repo:knarayanareddy/rocketboard-ai-guide/supabase/migrations/20260316000001_hybrid_search_v2.sql:180-233] [SOURCE: Technical documents/06_RAG_Retrieval_and_Hybrid_Search.txt:1-30]";

  const results = extractCitations(input);

  assertEquals(results.length, 2, "Should find exactly 2 citations");

  // First citation
  assertEquals(
    results[0].path,
    "repo:knarayanareddy/rocketboard-ai-guide/supabase/migrations/20260316000001_hybrid_search_v2.sql",
  );
  assertEquals(results[0].start, 180);
  assertEquals(results[0].end, 233);

  // Second citation
  assertEquals(
    results[1].path,
    "Technical documents/06_RAG_Retrieval_and_Hybrid_Search.txt",
  );
  assertEquals(results[1].start, 1);
  assertEquals(results[1].end, 30);
});

Deno.test("Part B: Regression Test - Path with colons in single citation", () => {
  const input =
    "[SOURCE: repo:knarayanareddy/rocketboard-ai-guide/README.md:10-20]";
  const results = extractCitations(input);

  assertEquals(results.length, 1);
  assertEquals(
    results[0].path,
    "repo:knarayanareddy/rocketboard-ai-guide/README.md",
  );
  assertEquals(results[0].start, 10);
  assertEquals(results[0].end, 20);
});

Deno.test("Part B: Regression Test - Malicious host-like path", () => {
  const input = "[SOURCE: https://malicious.com/payload:1-100]";
  const results = extractCitations(input);

  assertEquals(results.length, 1);
  assertEquals(results[0].path, "https://malicious.com/payload");
});
