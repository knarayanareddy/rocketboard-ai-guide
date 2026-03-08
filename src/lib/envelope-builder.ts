import type { EvidenceSpan } from "@/hooks/useEvidenceSpans";

interface PackInfo {
  pack_id: string | null;
  pack_version?: number;
  title?: string | null;
  description?: string | null;
  language_mode?: string | null;
  tracks?: { track_key: string; title: string; description?: string | null }[];
}

interface AuthInfo {
  user_id: string | null;
  org_id?: string | null;
  roles?: string[];
  pack_access_level?: string | null;
}

interface AudienceProfile {
  audience?: string;
  depth?: string;
  glossary_density?: string;
}

interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

const DEFAULT_LIMITS = {
  max_spans_to_cite: 10,
  max_module_words: 1400,
  max_section_words_hint: 200,
  max_note_prompts_per_section: 3,
  max_key_takeaways: 7,
  max_reflection_prompts: 4,
  max_quiz_questions: 5,
  max_chat_words: 350,
  max_warnings: 8,
};

function baseEnvelope(
  taskType: string,
  auth: AuthInfo,
  pack: PackInfo,
) {
  return {
    task: {
      type: taskType,
      request_id: crypto.randomUUID(),
      timestamp_iso: new Date().toISOString(),
    },
    auth: {
      actor_type: auth.user_id ? "user" : "anonymous",
      user_id: auth.user_id,
      org_id: auth.org_id || null,
      roles: auth.roles || [],
      pack_permissions: {
        pack_id: pack.pack_id,
        access_level: auth.pack_access_level || null,
      },
    },
    pack: {
      pack_id: pack.pack_id,
      pack_version: pack.pack_version || 1,
      title: pack.title || null,
      description: pack.description || null,
      language_mode: pack.language_mode || "english",
      tracks: pack.tracks || [],
    },
    context: {
      current_module_key: null as string | null,
      current_track_key: null as string | null,
      output_language: null as string | null,
      audience_profile: { audience: "technical", depth: "standard", glossary_density: "standard" } as AudienceProfile,
      learner_profile: { role: null, experience_level: null },
      learner_state: { completed_module_keys: [], last_opened_module_key: null, last_opened_track_key: null },
      author_instruction: null as string | null,
      conversation: { conversation_id: null, messages: [] as ConversationMessage[] },
      ui_capabilities: { notes_enabled: true, quiz_enabled: true, quiz_shown_at_end_of_module: true, quiz_required_for_completion: false },
    },
    templates: { applied_templates: [] },
    retrieval: { query: null as string | null, evidence_spans: [] as EvidenceSpan[] },
    inputs: {
      module_revision: null,
      existing_module: null,
      module: null,
      existing_template: null,
      original_section_markdown: null,
    },
    generation_prefs: {
      include_mermaid_if_supported: false,
      target_reading_level: "plain",
      max_sections_hint: 7,
    },
    limits: { ...DEFAULT_LIMITS },
    expected_output_schema: {},
  };
}

export function buildChatEnvelope(opts: {
  auth: AuthInfo;
  pack: PackInfo;
  messages: ConversationMessage[];
  evidenceSpans?: EvidenceSpan[];
  moduleKey?: string | null;
  trackKey?: string | null;
  audienceProfile?: AudienceProfile;
  query?: string;
}) {
  const env = baseEnvelope("chat", opts.auth, opts.pack);
  env.context.conversation.messages = opts.messages;
  env.context.current_module_key = opts.moduleKey || null;
  env.context.current_track_key = opts.trackKey || null;
  if (opts.audienceProfile) env.context.audience_profile = { ...env.context.audience_profile, ...opts.audienceProfile };
  env.retrieval.evidence_spans = opts.evidenceSpans || [];
  env.retrieval.query = opts.query || null;
  return env;
}

// Stub builders for future task types
export function buildModulePlannerEnvelope(opts: {
  auth: AuthInfo;
  pack: PackInfo;
  evidenceSpans?: EvidenceSpan[];
}) {
  const env = baseEnvelope("module_planner", opts.auth, opts.pack);
  env.retrieval.evidence_spans = opts.evidenceSpans || [];
  env.retrieval.query = "architecture setup configuration deployment infrastructure code structure";
  return env;
}
export function buildGenerateModuleEnvelope(opts: { auth: AuthInfo; pack: PackInfo }) {
  return baseEnvelope("generate_module", opts.auth, opts.pack);
}
export function buildGenerateQuizEnvelope(opts: { auth: AuthInfo; pack: PackInfo }) {
  return baseEnvelope("generate_quiz", opts.auth, opts.pack);
}
export function buildGenerateGlossaryEnvelope(opts: { auth: AuthInfo; pack: PackInfo }) {
  return baseEnvelope("generate_glossary", opts.auth, opts.pack);
}
export function buildGeneratePathsEnvelope(opts: { auth: AuthInfo; pack: PackInfo }) {
  return baseEnvelope("generate_paths", opts.auth, opts.pack);
}
export function buildGenerateAskLeadEnvelope(opts: { auth: AuthInfo; pack: PackInfo }) {
  return baseEnvelope("generate_ask_lead", opts.auth, opts.pack);
}
export function buildSimplifySectionEnvelope(opts: { auth: AuthInfo; pack: PackInfo }) {
  return baseEnvelope("simplify_section", opts.auth, opts.pack);
}
export function buildRefineModuleEnvelope(opts: { auth: AuthInfo; pack: PackInfo }) {
  return baseEnvelope("refine_module", opts.auth, opts.pack);
}
export function buildCreateTemplateEnvelope(opts: { auth: AuthInfo; pack: PackInfo }) {
  return baseEnvelope("create_template", opts.auth, opts.pack);
}
export function buildRefineTemplateEnvelope(opts: { auth: AuthInfo; pack: PackInfo }) {
  return baseEnvelope("refine_template", opts.auth, opts.pack);
}
