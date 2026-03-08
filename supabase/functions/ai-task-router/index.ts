import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function errorResponse(status: number, body: object) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function unsupportedTask(requestId: string, taskType: string) {
  return errorResponse(200, {
    type: "error",
    request_id: requestId,
    error_code: "unsupported_task",
    message: `Task type '${taskType}' not yet implemented`,
    suggested_search_queries: [],
    warnings: [],
  });
}

async function handleChat(envelope: any): Promise<Response> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const context = envelope.context || {};
  const retrieval = envelope.retrieval || {};
  const limits = envelope.limits || {};
  const audience = context.audience_profile || {};
  const conversation = context.conversation || {};

  // Build evidence spans block
  const spans = retrieval.evidence_spans || [];
  const spansBlock = spans.length > 0
    ? `\n## Evidence Spans\nUse these numbered evidence spans to ground your answers. Cite them as [S1], [S2], etc.\n\n${spans.map((s: any) => `[${s.span_id}] ${s.path} (lines ${s.start_line}-${s.end_line}):\n\`\`\`\n${s.text}\n\`\`\``).join("\n\n")}`
    : "";

  // Build pack context
  const tracks = (pack.tracks || []).map((t: any) => `- ${t.track_key}: ${t.title}`).join("\n");
  const packBlock = pack.title
    ? `\n## Pack Context\nPack: ${pack.title}\n${pack.description || ""}\nTracks:\n${tracks}`
    : "";

  // Module context
  const moduleBlock = context.current_module_key
    ? `\nCurrent module: ${context.current_module_key}${context.current_track_key ? ` (track: ${context.current_track_key})` : ""}`
    : "";

  // Audience instructions
  const audienceBlock = audience.audience
    ? `\nAudience: ${audience.audience}, depth: ${audience.depth || "standard"}`
    : "";

  const systemPrompt = `You are RocketBoard AI, an expert onboarding assistant. You help engineers learn about codebases and systems.

RULES:
- Ground your answers in the evidence spans provided. Cite spans using [S1], [S2] etc.
- If you cannot find evidence for a claim, mark it as unverified.
- If evidence contradicts itself, note the contradiction.
- Keep responses under ${limits.max_chat_words || 350} words.
- Use markdown formatting.
- Suggest relevant follow-up search queries.
${packBlock}${moduleBlock}${audienceBlock}${spansBlock}

You MUST respond with VALID JSON matching this schema:
{
  "type": "chat",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "<now>", "request_id": "${requestId}" },
  "response_markdown": "<your markdown response>",
  "referenced_spans": [{ "span_id": "S1", "path": "...", "chunk_id": "..." }],
  "unverified_claims": [{ "claim": "...", "reason": "..." }],
  "contradictions": [],
  "suggested_search_queries": ["query1", "query2"],
  "suggested_next": { "module_key": null, "track_key": null },
  "warnings": []
}

Return ONLY the JSON object, no markdown fences, no extra text.`;

  const messages = (conversation.messages || []).map((m: any) => ({
    role: m.role,
    content: m.content,
  }));

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: false,
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return errorResponse(429, { error: "Rate limit exceeded. Please try again in a moment." });
    }
    if (response.status === 402) {
      return errorResponse(402, { error: "AI credits exhausted. Please add credits to continue." });
    }
    const t = await response.text();
    console.error("AI gateway error:", response.status, t);
    return errorResponse(500, { error: "AI service unavailable" });
  }

  const aiResult = await response.json();
  const rawContent = aiResult.choices?.[0]?.message?.content || "";

  // Try to parse the JSON response
  try {
    // Strip potential markdown fences
    const cleaned = rawContent.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
    const parsed = JSON.parse(cleaned);
    // Ensure required fields
    parsed.type = "chat";
    parsed.request_id = requestId;
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    // If AI didn't return valid JSON, wrap the raw text
    return new Response(JSON.stringify({
      type: "chat",
      request_id: requestId,
      pack_id: pack.pack_id || null,
      pack_version: pack.pack_version || 1,
      generation_meta: { timestamp_iso: new Date().toISOString(), request_id: requestId },
      response_markdown: rawContent,
      referenced_spans: [],
      unverified_claims: [],
      contradictions: [],
      suggested_search_queries: [],
      suggested_next: { module_key: null, track_key: null },
      warnings: ["AI response was not valid JSON; returning raw text."],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const envelope = await req.json();
    const taskType = envelope.task?.type;
    const requestId = envelope.task?.request_id || crypto.randomUUID();

    if (!taskType) {
      return errorResponse(400, { error: "Missing task.type in envelope" });
    }

    switch (taskType) {
      case "chat":
        return await handleChat(envelope);
      case "module_planner":
      case "generate_module":
      case "generate_quiz":
      case "generate_glossary":
      case "generate_paths":
      case "generate_ask_lead":
      case "simplify_section":
      case "refine_module":
      case "create_template":
      case "refine_template":
        return unsupportedTask(requestId, taskType);
      default:
        return errorResponse(400, {
          type: "error",
          request_id: requestId,
          error_code: "unknown_task",
          message: `Unknown task type: ${taskType}`,
          suggested_search_queries: [],
          warnings: [],
        });
    }
  } catch (e) {
    console.error("ai-task-router error:", e);
    return errorResponse(500, { error: e instanceof Error ? e.message : "Unknown error" });
  }
});
