# AGENTS.md — Read This First (AI Coding Agents)

This repo powers RocketBoard’s onboarding + grounded AI system (React frontend + Supabase Postgres/RLS + Edge Functions for ingestion/retrieval/generation).

This document is **operational guardrails** for AI agents making changes. It is not a replacement for README; it’s the “don’t break the platform” checklist.

## 0) Core principle: the system is contract-driven
RocketBoard relies on strict contracts between:
- ingestion → `knowledge_chunks` schema
- retrieval → evidence spans with stable `path + line_start/line_end + chunk_id`
- generation → canonical citations + snippet placeholders
- UI → citation badges `[S#]` backed by `source_map` / referenced spans

If you change any contract, update **both** the producer and consumer, plus migrations if needed.

---

## 1) Non-negotiable invariants (DO NOT BREAK)

### 1.1 RAG invariants (groundedness + citations)
**Canonical citation format (required):**
- Canonical citations in model output must remain:
  - `[SOURCE: <filepath>:<start>-<end>]`
- Router post-processing converts canonical citations into UI badges `[S1]`, `[S2]`, etc.

**Snippet contract (required):**
- The model must not output raw repo code blocks.
- Repo code must be requested using snippet placeholders:
  - `[SNIPPET: <filepath>:<start>-<end> | lang=<lang>]`
- Server hydrates snippets from evidence spans and emits code fences with a `// SOURCE:` header.

**Ordering is important (do not reorder):**
1) enforce “no direct repo code”
2) verify claims / strip uncited technical claims
3) hydrate snippets
4) canonicalize citations → UI badges + source map

**Bounded inputs/outputs (required):**
- Evidence span count and total evidence text must remain capped.
- Conversation history must remain capped.
- Author instructions must be capped.
(These are cost + safety controls.)

**Grounding SLO Gate (required):**
- All router responses MUST pass the Grounding SLO Gate evaluation.
- Default thresholds: `min_score: 0.80`, `max_strip_rate: 0.20`.
- If a response fails, the router must retry (up to 3x) or refuse with `insufficient_evidence`.
- This ensures only verified, grounded claims reach the user.

### 1.2 Security invariants (SSRF, secrets, credentials)
**SSRF policy is mandatory for any external fetch:**
- Any URL derived from `pack_sources.config`, user input, or connector config must be validated by the shared URL policy before `fetch()`.
- Reject:
  - non-http(s) schemes
  - localhost / loopback
  - link-local / metadata IP ranges
  - private IP ranges
  - raw IP literals (unless explicitly allowlisted)
  - non-standard ports (unless explicitly allowlisted)

**Secrets: single source of truth**
- Secret detection/redaction patterns must be centralized in `supabase/functions/_shared/secret-patterns.ts`.
- Ingestion redaction is the primary gate; router redaction is defense-in-depth.

**Credentials must never be stored in PostgREST-readable columns**
- Do not store raw tokens or refresh tokens in `pack_sources.config`.
- Use Vault/RPC-based credential storage via `supabase/functions/_shared/credentials.ts`.
- Never return decrypted keys to the browser.

**No secret logging**
- Never log env var values, tokens, OAuth codes, Authorization headers, or decrypted BYOK keys.
- Error messages returned to clients must be generic.

### 1.3 Data integrity invariants (generations, locks, cleanup, dedupe)
**Generation pinning**
- Ingestion/reindex writes chunks with a `generation_id` or `job_id`.
- Only one active generation per pack (via `pack_active_generation`).
- Ensure concurrency is serialized via `supabase/migrations/20260325000000_job_locks.sql` (Concurrency Lease Locks).

**No concurrent generation writers**
- Always acquire the pack-level ingestion/reindex lock before:
  - writing chunks for a new generation
  - flipping `pack_active_generation`
  - deleting old generations

**Cleanup on failure**
- If ingestion fails mid-run, delete partial writes for that `ingestion_job_id`.

**Dedupe + embedding reuse**
- `content_hash` (SHA256) must be computed consistently across ingestion paths.
- If an identical chunk existed in a previous run, reuse its embedding via `supabase/functions/_shared/embedding-reuse.ts`.

**Data Lifecycle Invariants**
- Purge must be scoped to `(pack_id, source_id)`. Never delete across packs.
- Every manual or automated deletion must record a row in `lifecycle_audit_events`.
- Do not delete Vault credentials during source purge.
- Retention cleanup must respect the `legal_hold` flag.

---

## 2) Where to change what (map of the codebase)

### Frontend (React)
- Envelope building (task request contract): `src/lib/envelope-builder.ts`
- AI task client: `src/lib/ai-client.ts`
- Retrieval clients: `src/lib/fetch-spans.ts`
- Output schema validation: `src/lib/schema-validator.ts`, `src/lib/output-schemas.ts`
- Citation UI: `src/components/chat/CitationBadge.tsx`, `src/components/chat/EvidenceSpanViewer.tsx`.

### Supabase Edge Functions (backend)
- Evidence retrieval gateway: `supabase/functions/retrieve-spans/`
- AI router / grounded pipeline: `supabase/functions/ai-task-router/`
- Ingestion hub / dispatcher: `supabase/functions/ingest-source/`
- Connector functions: `supabase/functions/ingest-*` (confluence, notion, jira, slack, url, etc.)
- Webhooks / remediation: `supabase/functions/github-webhook/`, `check-staleness/`, `auto-remediate-module/`

### Shared backend libraries (must reuse; do not fork copies)
- Secret patterns / redaction: `supabase/functions/_shared/secret-patterns.ts`
- SSRF-safe URL validation: `supabase/functions/_shared/external-url-policy.ts`
- AST chunking: `supabase/functions/_shared/ast-chunker.ts`
- Smart chunking / normalizers (docs sources): `supabase/functions/_shared/smart-chunker.ts`, `content-normalizers.ts`, `hash-utils.ts`
- Vault credentials: `supabase/functions/_shared/credentials.ts`
- Telemetry: `supabase/functions/_shared/telemetry.ts`
- Ingestion guards (cooldowns/caps): `supabase/functions/_shared/ingestion-guards.ts`
- Embedding reuse: `supabase/functions/_shared/embedding-reuse.ts`

### SQL / migrations
- Never edit old migrations.
- Add a new migration file in `supabase/migrations/` for schema changes or SQL function changes.
- Keep RPC security tight (revoke PUBLIC; grant only what is required).
- Any changes to retrieval functions must consider RLS + pack isolation.

---

## 3) Common gotchas (read before editing)
- **RLS vs service_role:** `service_role` bypasses RLS. Make sure only Edge Functions hold `service_role` keys.
- **RPC privileges:** Do not accidentally grant execute on sensitive RPCs to `authenticated` or `public`.
- **Edge runtime constraints:** Avoid large in-memory arrays for massive repos; batch DB writes; cap fetch concurrency.
- **Citation validity:** Routers may strip technical claims if citations are missing or invalid.
- **Snippet hydration proximity:** Snippet placeholders require nearby matching canonical citations to hydrate.
- **Do not regress SSRF checks:** Every config-derived URL must be validated.
- **Do not regress redaction:** Always run secret assessment on ingestion; router redaction is a second pass.

---

## 4) Playbooks (how to implement changes safely)

### 4.1 Adding a new connector (checklist)
When adding `ingest-<source>`:
1) **Credentials**
   - Use Vault/RPC storage via shared credentials helper (`supabase/functions/_shared/credentials.ts`).
   - Never store tokens in `pack_sources.config`.
2) **SSRF**
   - Validate every outbound URL with the shared URL policy (`supabase/functions/_shared/external-url-policy.ts`).
3) **Normalization + chunking**
   - Convert source content into normalized Markdown/text using `supabase/functions/_shared/content-normalizers.ts`.
   - Use `supabase/functions/_shared/smart-chunker.ts` (heading-aware).
   - Generate stable `chunk_id` and compute `content_hash` using `supabase/functions/_shared/hash-utils.ts`.
4) **Redaction**
   - Run shared secret assessment per chunk (`supabase/functions/_shared/secret-patterns.ts`).
5) **Embeddings**
   - Reuse embeddings by `content_hash` using `supabase/functions/_shared/embedding-reuse.ts`.
6) **Job tracking**
   - Create/update `ingestion_jobs`.
   - Enforce cooldowns + caps using `supabase/functions/_shared/ingestion-guards.ts`.
7) **Telemetry**
   - Create a trace using `supabase/functions/_shared/telemetry.ts`.
8) **Tests**
   - Add tests for URL validation and redaction behavior.

### 4.3 Modifying Roadmap / Playlists (Hardening)
1) **Integrity**
   - Circular dependencies must be prevented at the DB level (trigger).
   - Status transitions must follow allowed paths (blocked -> available -> in_progress -> done).
2) **Tenancy**
   - Every read must go through `has_pack_access` or `is_pack_member` RLS.
   - Every write must check pack ownership/author level.
3) **QA Verification**
   - Any change to Roadmap RLS must be verified using the SQL test harness in `supabase/qa/roadmap/`.
4) **Rollout**
   - Use the `roadmap_enabled` flag on the `packs` table for a phased rollout.
---

## 5) Verification checklist (must run before final output)
- [ ] Typecheck/lint passes (`deno check`, `tsc`)
- [ ] Migrations apply cleanly on a fresh DB
- [ ] Ingestion: run a small test; verify cooldowns/caps and embedding reuse.
- [ ] Retrieval: verify pack membership gate and stable anchors.
- [ ] Router: verify citations appear and snippets hydrate correctly.
- [ ] Security: confirm no secrets/tokens in logs.
- [ ] Tenancy: confirm no cross-pack leakage.

---

## 6) Updating this file
If you add a connector, change retrieval, or change the router contract, update this `AGENTS.md` in the same PR.
