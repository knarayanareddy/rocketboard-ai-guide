export interface RerankedSpan {
  id: string; // original span_id or chunk_id
  score: number; // 0-10
  reason?: string;
}

export async function batchRerankWithLLM(query: string, spans: any[]): Promise<any[]> {
  if (!spans || spans.length === 0) return [];
  
  // Use platform key (LOVABLE_API_KEY) and Gemini Flash for cheap infra processing
  const apiKey = Deno.env.get("LOVABLE_API_KEY") || Deno.env.get("OPENAI_API_KEY") || "";
  const endpoint = "https://ai.gateway.lovable.dev/v1/chat/completions";
  
  if (!apiKey) {
    console.warn("[RERANKER] No API key found for reranking, skipping...");
    return spans;
  }

  // 1. Pack spans for batch evaluation
  const spansToProcess = spans.slice(0, 30); // Max 30 for safety/context limits
  const spansJson = spansToProcess.map((s, idx) => ({
    index: idx,
    id: s.span_id || s.chunk_id || s.id,
    path: s.path,
    text: s.text?.slice(0, 1000) // Truncate individual spans for prompt safety
  }));

  const systemPrompt = `You are a precision RAG reranker. 
Score retrieved code/document snippets for their relevance to the user's query.
Relevance Score Scale (0-10):
- 10: Perfect match, contains the exact answer or necessary code.
- 7-9: Highly relevant, provides crucial context.
- 4-6: Partially relevant, might be useful but isn't a direct answer.
- 1-3: Tangentially related but likely noise.
- 0: Completely irrelevant.

Output ONLY a JSON array of objects: [{"id": "...", "score": 8, "reason": "..."}].
Prioritize snippets that show definitions, implementations, or specific configurations requested.`;

  const userPrompt = `Query: ${query}\n\nCandidate Snips:\n${JSON.stringify(spansJson, null, 2)}`;

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!res.ok) {
       console.error("[RERANKER] API Error:", await res.text());
       return spans; // Fallback to original order
    }

    const data = await res.json();
    const content = data.choices[0].message.content;
    const scores: RerankedSpan[] = JSON.parse(content).scores || JSON.parse(content); // Handle different JSON wrappers

    // 2. Map scores back to original spans and sort
    const scoredSpans = spansToProcess.map(s => {
       const scoreData = scores.find(rs => rs.id === (s.span_id || s.chunk_id || s.id));
       return { ...s, relevance_score: scoreData?.score || 0 };
    });

    // 3. Filter by relevance threshold (e.g. >= 3) and sort
    const filtered = scoredSpans
      .filter(s => s.relevance_score >= 3)
      .sort((a, b) => b.relevance_score - a.relevance_score);

    console.log(`[RERANKER] Input: ${spans.length}, Output: ${filtered.length}, Top Score: ${filtered[0]?.relevance_score}`);
    return filtered;

  } catch (err) {
    console.error("[RERANKER] Fatal error:", err);
    return spans; // Graceful fallback
  }
}
