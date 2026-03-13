# 🚀 RocketBoard — AI-Powered Developer Onboarding

> Transform your codebase, documentation, and internal knowledge into structured, interactive learning experiences — powered by evidence-grounded AI.

[![Built with Lovable](https://img.shields.io/badge/Built_with-Lovable-ff69b4)](https://lovable.dev)
[![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E)](https://supabase.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org)
[![React](https://img.shields.io/badge/React-18-61dafb)](https://react.dev)

---

## What is RocketBoard?

RocketBoard is an **AI-native onboarding platform** for engineering teams. It ingests your GitHub repos, Confluence docs, Notion pages, and other knowledge sources — then generates structured learning modules, quizzes, glossaries, exercises, and onboarding paths. Every piece of generated content is **grounded in evidence spans** from your actual codebase, with full citation tracking.

### Who is it for?

| Role | What they do |
|------|-------------|
| **Pack Owners / Admins** | Create organizations & packs, invite members, manage settings |
| **Authors** | Connect sources, curate AI-generated plans, review & publish modules |
| **Learners** | Read modules, take quizzes, complete exercises, track progress |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│  Dashboard · Modules · Quizzes · Exercises · Glossary · Chat    │
│  Help Center · Tours · Analytics · Content Health · FAQ         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ JWT Auth + HTTPS
┌───────────────────────────▼─────────────────────────────────────┐
│                   Supabase Edge Functions (Deno)                │
│                                                                 │
│  ai-task-router ─── 14 AI task types (chat, generate, quiz...) │
│  retrieve-spans ── Hybrid vector + full-text search (pgvector) │
│  ingest-source ─── GitHub, Confluence, Notion, Slack, Jira...  │
│  github-webhook ── Staleness detection + auto-remediation      │
│  _shared/telemetry ── Langfuse observability traces            │
│  + 18 more functions                                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│              Supabase (PostgreSQL + pgvector + Auth)            │
│                                                                 │
│  55 migrations · RLS on all tables · Hybrid search RPCs        │
│  Organizations → Packs → Sources → Chunks → Modules            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                    Lovable AI Gateway                            │
│              Google Gemini 3 Flash Preview                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Features

### 🧠 AI Task Router (14 Task Types)
The central AI orchestration engine. Every request goes through input sanitization, secret redaction, evidence span retrieval, and structured JSON output validation.

| Task Type | Description |
|-----------|-------------|
| `chat` | Module-specific Q&A with citation grounding |
| `global_chat` | Platform-wide assistant (Mission Control) |
| `module_planner` | Analyze sources and propose a learning plan |
| `generate_module` | Generate full module content from evidence |
| `refine_module` | Author-directed module improvements |
| `generate_quiz` | Evidence-grounded multiple-choice assessments |
| `generate_glossary` | Pack-specific technical term dictionary |
| `generate_paths` | Day 1 / Week 1 onboarding checklists |
| `generate_ask_lead` | Curated questions for 1:1 meetings |
| `generate_exercises` | Hands-on coding challenges with hints |
| `verify_exercise` | AI review of learner exercise submissions |
| `simplify_section` | On-demand content simplification |
| `create_template` / `refine_template` | Module structure blueprints |

### 📦 Source Ingestion (13 Connectors)
Connect your knowledge sources and RocketBoard ingests, chunks, and embeds them for retrieval.

- **GitHub** — repos via OAuth, with webhook-driven staleness detection
- **Confluence** / **Notion** / **SharePoint** / **Google Drive** — documentation
- **Slack** / **Linear** / **Jira** / **PagerDuty** — operational context
- **Figma** / **Loom** / **Postman** / **OpenAPI** — design & API specs
- **URL** — arbitrary web pages

### 🔍 Hybrid Search (pgvector + Full-Text)
Evidence retrieval uses `match_chunks_hybrid` RPC combining:
- **Semantic similarity** via pgvector embeddings
- **Full-text search** via PostgreSQL `tsvector`
- **Source weighting** — authors can boost/demote individual sources

### 🎯 Interactive Chat Citations
AI responses include inline citation badges (`[S1]`, `[S2]`) that are fully interactive:
- **Hover** for a source code preview
- **Click** to open the full file in the Source Explorer
- Bottom-of-response source badges provide quick navigation

### 📊 AI Observability (Langfuse Integration)
Full telemetry tracing for every AI task:
- Token usage, latency, and estimated cost per request
- Structured traces tagged with `pack_id`, `user_id`, `task_type`, `module_key`
- `trace_id` injected into every response for feedback loop correlation
- Graceful fallback to structured `console.log` when Langfuse is not configured

### 🔄 Content Health & Auto-Remediation
- **GitHub Webhook** detects pushes that affect cited source files
- **Staleness scoring** per module based on changed chunks
- **AI Agent** reads raw git diffs and drafts precise content updates
- Authors review side-by-side diffs and accept with one click

### 📚 Learning Experience
- **Modules** with expandable sections, code snippets, learning objectives
- **Quizzes** with immediate feedback and evidence-linked explanations
- **Exercises** — code find, explain, configure, debug, explore challenges
- **Glossary** with density controls and code-contextualized definitions
- **Onboarding Paths** — Day 1 & Week 1 step-by-step checklists
- **Ask Your Lead** — curated high-signal questions for 1:1 meetings
- **Notes & Bookmarks** — personal note-taking with guided prompts
- **FAQ** — AI-detected repeated questions surfaced for author curation

### 🎓 Platform Features
- **Guided Tours** — 22 interactive walkthroughs for every major page
- **Help Center** — searchable in-app articles with custom card/timeline components
- **Help Tooltips** — contextual `ⓘ` tooltips across the entire platform
- **Analytics** — module engagement, quiz performance, cohort scatter charts
- **Feedback** — learner content ratings, chat report system with trace IDs
- **Team Directory** — knowledge owners, meeting checklists, expertise areas
- **Discussions** — async threaded conversations scoped to modules/packs
- **Graduation Modal** — ticket syndication when learners complete onboarding

---

## Multi-Tenant Data Model

```
Organizations
  └── Packs
        ├── Sources → Ingestion Jobs → Knowledge Chunks (with embeddings)
        ├── Generated Modules (draft / published)
        ├── Pack Tracks (Frontend, Backend, Infra, Cross-Repo)
        ├── Pack Members (with roles: admin, author, learner)
        └── User Data (progress, quiz scores, notes, chat, bookmarks)
```

- **RLS policies** on every table with `is_pack_member()` checks
- **`profiles`** table allows "view all" (social directory), all other user data is row-scoped
- **`pack_id`** written into every user-data mutation for tenant isolation

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 + TypeScript |
| **Build** | Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **Animations** | Framer Motion |
| **State** | TanStack React Query + React Context |
| **Routing** | React Router v6 |
| **Charts** | Recharts |
| **Markdown** | react-markdown + custom `MarkdownRenderer` (cards, timelines, citations) |
| **Icons** | Lucide React |
| **Backend** | Supabase (PostgreSQL + pgvector + Auth + Edge Functions) |
| **AI** | Lovable AI Gateway → Google Gemini 3 Flash Preview |
| **Observability** | Langfuse (LLM tracing) + structured logging fallback |
| **Notifications** | Sonner (toast notifications) |

---

## Project Structure

```
src/
├── components/           # UI components
│   ├── ui/               # shadcn/ui primitives
│   ├── ModuleChatPanel.tsx    # AI chat with interactive citations
│   ├── MarkdownRenderer.tsx   # Custom markdown (cards, steps, citations)
│   ├── CitationBadge.tsx      # Hover preview + source navigation
│   ├── ChatReportDialog.tsx   # Feedback with trace_id
│   ├── TourOverlay.tsx        # Guided tour system
│   └── ...50+ components
├── data/
│   ├── help-content.ts        # Help Center articles
│   ├── tours.ts               # 22 page tours
│   ├── onboarding-data.ts     # Static module content
│   └── ...
├── hooks/                # Custom React hooks (30+)
│   ├── useProgress.ts         # Pack-aware progress tracking
│   ├── useChatFeedback.ts     # Report with trace_id
│   ├── useTelemetry.ts        # Module engagement telemetry
│   └── ...
├── lib/
│   ├── ai-client.ts           # AI task router client
│   ├── schema-validator.ts    # AI output validation
│   ├── ai-errors.ts           # Structured error handling
│   ├── fetch-spans.ts         # Evidence retrieval client
│   └── tour-system.ts         # Tour engine
├── pages/                # 20+ route pages
└── integrations/         # Auto-generated Supabase types

supabase/
├── functions/
│   ├── _shared/
│   │   └── telemetry.ts       # Langfuse tracing wrapper
│   ├── ai-task-router/        # Central AI orchestration (14 task types)
│   ├── retrieve-spans/        # Hybrid vector + full-text search
│   ├── github-webhook/        # Staleness detection
│   ├── auto-remediate-module/ # AI content repair
│   ├── check-staleness/       # Freshness scoring
│   ├── ingest-source/         # GitHub ingestion
│   ├── ingest-confluence/     # Confluence ingestion
│   ├── ingest-notion/         # Notion ingestion
│   ├── ingest-slack/          # Slack ingestion
│   └── ...13 more connectors
└── migrations/            # 55 database migrations
```

---

## Security

- **JWT Authentication** on all Edge Functions (except legacy `module-chat`)
- **Rate limiting** — 30 requests/minute per user in `ai-task-router`
- **Input sanitization** — author instructions capped at 2k chars, evidence spans at 50/100k chars, conversation at 50 messages
- **Secret redaction** — 12 regex patterns strip AWS keys, JWTs, connection strings, GitHub tokens, API keys before AI processing
- **RLS** on every Supabase table with pack-scoped access controls
- **Pack authorization** — author tasks require `author` role, learner tasks require `learner` role

---

## Getting Started

```bash
# Clone
git clone https://github.com/knarayanareddy/rocketboard-ai-guide.git
cd rocketboard-ai-guide

# Install
npm install

# Dev server
npm run dev
```

### Environment Variables
```env
VITE_SUPABASE_URL=<your supabase url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your anon key>
```

### Edge Function Secrets (Supabase Dashboard)
```
LOVABLE_API_KEY=<lovable ai gateway key>
LANGFUSE_PUBLIC_KEY=<optional, for observability>
LANGFUSE_SECRET_KEY=<optional, for observability>
LANGFUSE_BASE_URL=https://cloud.langfuse.com
```

---

## License

Private repository. All rights reserved.
