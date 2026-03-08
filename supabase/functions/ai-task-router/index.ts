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

function jsonResponse(body: object) {
  return new Response(JSON.stringify(body), {
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

function buildSpansBlock(spans: any[]): string {
  if (!spans.length) return "";
  return `\n## Evidence Spans\nUse these numbered evidence spans to ground your answers. Cite them as [S1], [S2], etc.\n\n${spans.map((s: any) => `[${s.span_id}] ${s.path} (lines ${s.start_line}-${s.end_line}):\n\`\`\`\n${s.text}\n\`\`\``).join("\n\n")}`;
}

function buildPackBlock(pack: any): string {
  const tracks = (pack.tracks || []).map((t: any) => `- ${t.track_key}: ${t.title}`).join("\n");
  return pack.title ? `\n## Pack Context\nPack: ${pack.title}\n${pack.description || ""}\nTracks:\n${tracks}` : "";
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      stream: false,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const t = await response.text();
    if (status === 429) throw { status: 429, message: "Rate limit exceeded. Please try again in a moment." };
    if (status === 402) throw { status: 402, message: "AI credits exhausted. Please add credits to continue." };
    console.error("AI gateway error:", status, t);
    throw { status: 500, message: "AI service unavailable" };
  }

  const aiResult = await response.json();
  return aiResult.choices?.[0]?.message?.content || "";
}

function parseAIJson(raw: string, defaults: object): any {
  try {
    const cleaned = raw.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return { ...defaults, warnings: ["AI response was not valid JSON; returning raw text."], _raw: raw };
  }
}

// ─── CHAT HANDLER ───
async function handleChat(envelope: any): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const context = envelope.context || {};
  const retrieval = envelope.retrieval || {};
  const limits = envelope.limits || {};
  const audience = context.audience_profile || {};
  const conversation = context.conversation || {};

  const spansBlock = buildSpansBlock(retrieval.evidence_spans || []);
  const packBlock = buildPackBlock(pack);
  const moduleBlock = context.current_module_key
    ? `\nCurrent module: ${context.current_module_key}${context.current_track_key ? ` (track: ${context.current_track_key})` : ""}`
    : "";
  const audienceBlock = audience.audience ? `\nAudience: ${audience.audience}, depth: ${audience.depth || "standard"}` : "";

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

  const messages = (conversation.messages || []).map((m: any) => ({ role: m.role, content: m.content }));

  // For chat we need to pass the full conversation, so use callAI with the last user message
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

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
    if (response.status === 429) return errorResponse(429, { error: "Rate limit exceeded." });
    if (response.status === 402) return errorResponse(402, { error: "AI credits exhausted." });
    const t = await response.text();
    console.error("AI gateway error:", response.status, t);
    return errorResponse(500, { error: "AI service unavailable" });
  }

  const aiResult = await response.json();
  const rawContent = aiResult.choices?.[0]?.message?.content || "";

  const parsed = parseAIJson(rawContent, {
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
  });
  parsed.type = "chat";
  parsed.request_id = requestId;
  return jsonResponse(parsed);
}

// ─── MODULE PLANNER HANDLER ───
async function handleModulePlanner(envelope: any): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const retrieval = envelope.retrieval || {};
  const spans = retrieval.evidence_spans || [];

  const spansBlock = buildSpansBlock(spans);
  const packBlock = buildPackBlock(pack);

  const hasTracks = (pack.tracks || []).length > 0;
  const tracksInstruction = hasTracks
    ? "The pack already has these tracks defined. Assign modules to existing tracks where appropriate."
    : "The pack has no tracks yet. Propose tracks based on what you see in the evidence.";

  const systemPrompt = `You are RocketBoard AI Module Planner. Your job is to analyze codebase evidence spans and propose a structured onboarding plan.

TASK:
1. Analyze the evidence spans to understand the codebase/system architecture.
2. Detect technology signals (e.g., "uses_kubernetes", "has_ci_pipeline", "uses_typescript", "has_monitoring", "has_auth_system", "uses_react", "has_database_migrations", etc.).
3. ${tracksInstruction}
4. Propose an ordered list of onboarding modules that cover the key areas a new engineer needs to learn.
5. Ground ALL claims in evidence span citations [S1], [S2], etc.

GUIDELINES:
- Order modules from foundational (setup, architecture overview) to advanced (deployment, monitoring).
- Each module should be completable in 10-30 minutes of reading.
- Assign difficulty levels: beginner for setup/overview, intermediate for core systems, advanced for complex topics.
- Include a mix of cross-cutting modules (architecture, conventions) and track-specific modules.
${packBlock}${spansBlock}

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "module_planner",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "${new Date().toISOString()}", "request_id": "${requestId}" },
  "detected_signals": [
    { "signal_key": "string", "confidence": "high|medium|low", "explanation": "string", "citations": [{ "span_id": "S1" }] }
  ],
  "tracks": [
    { "track_key": "string", "title": "string", "description": "string" }
  ],
  "module_plan": [
    {
      "module_key": "mod-1",
      "title": "string",
      "description": "string",
      "estimated_minutes": 15,
      "difficulty": "beginner|intermediate|advanced",
      "rationale": "string",
      "citations": [{ "span_id": "S1" }],
      "track_key": "string|null",
      "audience": "technical",
      "depth": "standard"
    }
  ],
  "contradictions": [],
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt = `Analyze the ${spans.length} evidence spans provided and create a comprehensive onboarding module plan for the "${pack.title || "unknown"}" pack.`;

  try {
    const raw = await callAI(systemPrompt, userPrompt);
    const parsed = parseAIJson(raw, {
      type: "module_planner",
      request_id: requestId,
      pack_id: pack.pack_id || null,
      pack_version: pack.pack_version || 1,
      generation_meta: { timestamp_iso: new Date().toISOString(), request_id: requestId },
      detected_signals: [],
      tracks: [],
      module_plan: [],
      contradictions: [],
    });
    parsed.type = "module_planner";
    parsed.request_id = requestId;
    return jsonResponse(parsed);
  } catch (e: any) {
    if (e.status) return errorResponse(e.status, { error: e.message });
    throw e;
  }
}

// ─── GENERATE MODULE HANDLER ───
async function handleGenerateModule(envelope: any): Promise<Response> {
  const requestId = envelope.task?.request_id || crypto.randomUUID();
  const pack = envelope.pack || {};
  const context = envelope.context || {};
  const retrieval = envelope.retrieval || {};
  const limits = envelope.limits || {};
  const inputs = envelope.inputs || {};
  const audience = context.audience_profile || {};
  const spans = retrieval.evidence_spans || [];

  const spansBlock = buildSpansBlock(spans);
  const packBlock = buildPackBlock(pack);

  const moduleKey = inputs.module?.module_key || context.current_module_key || "mod-unknown";
  const moduleTitle = inputs.module?.title || "Untitled Module";
  const moduleDesc = inputs.module?.description || "";
  const trackKey = inputs.module?.track_key || context.current_track_key || null;
  const moduleRevision = inputs.module_revision || 1;

  const systemPrompt = `You are RocketBoard AI Module Generator. Your job is to generate comprehensive onboarding module content grounded in evidence spans.

TASK: Generate a complete module titled "${moduleTitle}" (key: ${moduleKey}).
${moduleDesc ? `Description: ${moduleDesc}` : ""}
${trackKey ? `Track: ${trackKey}` : ""}
${packBlock}

RULES:
- Generate 4-7 sections, each with a clear heading, markdown content, learning objectives, note prompts, and citations.
- Ground ALL content in evidence spans. Cite using [S1], [S2], etc.
- Stay within ${limits.max_module_words || 1400} total words across all sections.
- Each section should have up to ${limits.max_note_prompts_per_section || 3} note prompts.
- Include up to ${limits.max_key_takeaways || 7} key takeaways.
- Include up to ${limits.max_reflection_prompts || 4} reflection prompts in the endcap.
- Audience: ${audience.audience || "technical"}, depth: ${audience.depth || "standard"}.
- Use markdown formatting with code blocks, lists, and emphasis where appropriate.
- Section IDs should be like "sec-1", "sec-2", etc.
${spansBlock}

You MUST respond with VALID JSON matching this exact schema:
{
  "type": "generate_module",
  "request_id": "${requestId}",
  "pack_id": "${pack.pack_id || ""}",
  "pack_version": ${pack.pack_version || 1},
  "generation_meta": { "timestamp_iso": "${new Date().toISOString()}", "request_id": "${requestId}" },
  "module_revision": ${moduleRevision},
  "module": {
    "module_key": "${moduleKey}",
    "title": "${moduleTitle}",
    "description": "string",
    "estimated_minutes": 15,
    "difficulty": "beginner|intermediate|advanced",
    "track_key": ${trackKey ? `"${trackKey}"` : "null"},
    "audience": "${audience.audience || "technical"}",
    "depth": "${audience.depth || "standard"}",
    "sections": [{
      "section_id": "sec-1",
      "heading": "string",
      "markdown": "string (full markdown content)",
      "learning_objectives": ["string"],
      "note_prompts": ["string"],
      "citations": [{ "span_id": "S1", "path": "...", "chunk_id": "..." }]
    }],
    "endcap": {
      "reflection_prompts": ["string"],
      "quiz_objectives": ["string"],
      "ready_for_quiz_markdown": "string",
      "citations": [{ "span_id": "S1" }]
    },
    "key_takeaways": ["string"],
    "evidence_index": [{
      "topic": "string",
      "citations": [{ "span_id": "S1" }]
    }]
  },
  "warnings": []
}

Return ONLY the JSON object. No markdown fences, no extra text.`;

  const userPrompt = `Generate the complete module "${moduleTitle}" using the ${spans.length} evidence spans provided. Make the content comprehensive, educational, and well-structured for onboarding engineers.`;

  try {
    const raw = await callAI(systemPrompt, userPrompt);
    const parsed = parseAIJson(raw, {
      type: "generate_module",
      request_id: requestId,
      pack_id: pack.pack_id || null,
      pack_version: pack.pack_version || 1,
      generation_meta: { timestamp_iso: new Date().toISOString(), request_id: requestId },
      module_revision: moduleRevision,
      module: {
        module_key: moduleKey,
        title: moduleTitle,
        description: moduleDesc,
        estimated_minutes: 15,
        difficulty: "beginner",
        track_key: trackKey,
        audience: audience.audience || "technical",
        depth: audience.depth || "standard",
        sections: [],
        endcap: { reflection_prompts: [], quiz_objectives: [], ready_for_quiz_markdown: "", citations: [] },
        key_takeaways: [],
        evidence_index: [],
      },
      warnings: ["AI response could not be parsed as JSON"],
    });
    parsed.type = "generate_module";
    parsed.request_id = requestId;
    return jsonResponse(parsed);
  } catch (e: any) {
    if (e.status) return errorResponse(e.status, { error: e.message });
    throw e;
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
        return await handleModulePlanner(envelope);
      case "generate_module":
        return await handleGenerateModule(envelope);
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
