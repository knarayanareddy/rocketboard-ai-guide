# RocketBoard — Feature Documentation

> **RocketBoard** is an interactive developer onboarding platform built with React, TypeScript, Tailwind CSS, and Lovable Cloud (Supabase). It guides new engineering hires through structured learning modules, quizzes, glossaries, and onboarding checklists — all personalized by role track and learning preferences.

---

## Table of Contents

1. [Authentication & Authorization](#1-authentication--authorization)
2. [Dashboard (Home Page)](#2-dashboard-home-page)
3. [Module System](#3-module-system)
4. [Section Viewer & Reading Progress](#4-section-viewer--reading-progress)
5. [Quiz System](#5-quiz-system)
6. [AI-Powered Module Chat](#6-ai-powered-module-chat)
7. [Learner Notes](#7-learner-notes)
8. [Glossary](#8-glossary)
9. [Onboarding Paths (Checklists)](#9-onboarding-paths-checklists)
10. [Ask Your Lead](#10-ask-your-lead)
11. [Settings & Preferences](#11-settings--preferences)
12. [Sidebar Navigation](#12-sidebar-navigation)
13. [Data Architecture](#13-data-architecture)
14. [Backend & Database](#14-backend--database)
15. [Tech Stack](#15-tech-stack)

---

## 1. Authentication & Authorization

### Overview
Full email/password authentication flow with protected routes. Users must sign up and verify their email before accessing the platform.

### Features
- **Sign Up**: Users register with display name, email, and password (min 6 characters). A verification email is sent before the account is activated.
- **Sign In**: Existing users log in with email and password.
- **Session Management**: Sessions are managed via Supabase Auth with automatic token refresh. The `AuthProvider` context (`src/hooks/useAuth.tsx`) wraps the entire app and exposes `user`, `session`, `loading`, and `signOut`.
- **Protected Routes**: All app routes (dashboard, modules, glossary, paths, settings, ask-lead) are wrapped in a `ProtectedRoute` component that redirects unauthenticated users to `/auth`.
- **Auth Route Guard**: The `/auth` page redirects already-authenticated users back to `/` to prevent double login.
- **Sign Out**: Available from the sidebar footer. Calls `supabase.auth.signOut()`.

### Files
- `src/pages/AuthPage.tsx` — Login/signup form UI
- `src/hooks/useAuth.tsx` — Auth context provider and `useAuth` hook
- `src/App.tsx` — Route definitions with `ProtectedRoute` and `AuthRoute` wrappers

---

## 2. Dashboard (Home Page)

### Overview
The main landing page after login. Provides an at-a-glance view of overall onboarding progress, quick-resume functionality, and a module grid.

### Features
- **Hero Section**: Animated welcome area with the RocketBoard branding.
- **Continue Learning Button**: Detects the last opened module (via `useLearnerState`) or the first incomplete module and provides a one-click resume button showing module name and progress percentage.
- **Stats Strip**: Displays key metrics:
  - Number of completed modules
  - Total sections read vs. total sections available
- **Overall Progress Bar**: Animated progress bar showing aggregate completion percentage across all modules.
- **Progress Chart**: Visual chart (`ProgressChart` component using Recharts) showing per-module progress breakdown.
- **Module Grid**: Cards for each module showing title, icon, description, difficulty badge, estimated time, and completion percentage. Clicking navigates to the module detail view.

### Files
- `src/pages/Index.tsx` — Dashboard page
- `src/components/StatsStrip.tsx` — Stats display component
- `src/components/ProgressChart.tsx` — Recharts-based progress visualization
- `src/components/ModuleCard.tsx` — Individual module card component

---

## 3. Module System

### Overview
The core learning content is organized into **modules**, each containing multiple **sections** targeting specific role tracks. There are 5 modules covering Architecture, Workflow, Monitoring, Security, and Testing.

### Module Structure
Each module (`Module` interface) contains:
- **id**: Unique identifier (e.g., `mod-1`)
- **title**: Module name (e.g., "Architecture Overview")
- **description**: Brief summary
- **icon**: Emoji icon
- **difficulty**: `beginner` | `intermediate` | `advanced` — shown as a color-coded badge
- **estimatedMinutes**: Time estimate
- **key_takeaways**: Array of key learning points displayed in a highlighted box
- **sections**: Array of `Section` objects (the actual content)
- **quiz**: Array of `QuizQuestion` objects
- **endcap**: Reflection prompts and quiz preparation guidance shown after all sections are read

### Section Structure
Each section contains:
- **id**: Unique identifier
- **title**: Section heading
- **content**: Markdown/text content
- **tracks**: Array of applicable tracks (`frontend`, `backend`, `infra`, `cross-repo`)
- **learning_objectives**: Optional array of learning objective strings
- **note_prompts**: Optional prompts to guide note-taking
- **notes**: Optional additional notes/tips

### Track Filtering
Users can filter sections by role track. The module view provides filter buttons for:
- **All Tracks** — shows everything
- **Frontend** / **Backend** / **Infra** / **Cross-Repo** — shows only sections tagged with that track

Each track has a distinct color-coded badge (`TrackBadge` component).

### Module List Page
A dedicated `/modules` page lists all modules in a grid with progress indicators.

### Module Detail Page
The `/modules/:moduleId` route shows:
- Module header with icon, title, difficulty badge
- Key takeaways box
- Progress bar (sections read / total sections)
- Tabbed interface: **Content** tab and **Quiz** tab
- Track filter controls
- Expandable section cards
- Endcap reflection section (appears when all sections are marked as read)

### Files
- `src/data/onboarding-data.ts` — All module/section/quiz data and TypeScript interfaces
- `src/pages/Modules.tsx` — Module list page
- `src/pages/ModuleView.tsx` — Module detail page
- `src/components/TrackBadge.tsx` — Color-coded track badge component

---

## 4. Section Viewer & Reading Progress

### Overview
Each section is rendered as an expandable card with reading state tracking persisted to the database.

### Features
- **Animated Entry**: Sections use staggered `framer-motion` animations for smooth page load.
- **Read/Unread State**: Each section has a "Mark as read" toggle button. Read state is stored per-user in the `user_progress` database table.
- **Visual Indicators**: Read sections show a distinct visual treatment (e.g., check icon, muted styling).
- **Learning Objectives**: If a section has learning objectives, they're displayed as pills/badges at the top.
- **Track Badges**: Each section shows which tracks it applies to.
- **Content Display**: Section content is rendered as formatted text.
- **Additional Notes**: Optional tips/notes shown in a distinct style.
- **Integrated Notes Panel**: Each section has an inline notes editor (see [Learner Notes](#7-learner-notes)).

### Progress Persistence
- Progress is stored in the `user_progress` table with columns: `user_id`, `module_id`, `section_id`, `is_read`, `read_at`.
- The `useProgress` hook manages all progress queries and mutations via TanStack React Query.
- Toggling a section's read state inserts or deletes the corresponding row.
- Progress data is used to compute per-module completion percentages and aggregate stats.

### Files
- `src/components/SectionViewer.tsx` — Section card component
- `src/hooks/useProgress.ts` — Progress management hook (queries, mutations, computed values)

---

## 5. Quiz System

### Overview
Each module has a built-in quiz that tests comprehension of the module content. Quizzes are multiple-choice and scores are persisted.

### Features
- **Multiple Choice Questions**: Each question has 4 options with one correct answer.
- **Immediate Feedback**: After selecting an answer, the correct/incorrect state is shown with an explanation.
- **Score Tracking**: Final score (correct/total) is saved to the `quiz_scores` table.
- **Score Persistence**: Uses upsert on `(user_id, module_id)` so retaking a quiz updates the existing score.
- **Quiz Tab**: Accessible via the "Quiz" tab on the module detail page.
- **Endcap Quiz Prep**: When all sections are read, a reflection/quiz prep section appears with:
  - Reflection prompts to review learning
  - Quiz objectives listing what the quiz covers
  - Encouragement text

### Files
- `src/components/QuizRunner.tsx` — Quiz UI component
- `src/hooks/useProgress.ts` — `saveQuizScore` mutation

---

## 6. AI-Powered Module Chat

### Overview
A floating AI chat panel on each module page that lets learners ask questions about the specific module they're studying. The AI has full context of the module's content, sections, and key takeaways.

### Features
- **Floating Action Button (FAB)**: A chat bubble icon fixed at the bottom-right of the module view. Clicking opens the chat panel.
- **Slide-Up Chat Panel**: A 380×520px panel with smooth spring animation (framer-motion).
- **Context-Aware AI**: The AI receives the full module context (title, description, key takeaways, all section titles and content) as a system prompt, so it can answer specific questions about the module material.
- **Streaming Responses**: Responses are streamed token-by-token via Server-Sent Events (SSE) for a real-time typing effect.
- **Markdown Rendering**: AI responses are rendered with `react-markdown` supporting formatted text, lists, code blocks, etc.
- **Chat History Persistence**: All messages (user and assistant) are saved to the `chat_messages` database table per user and module. History is loaded when the panel opens.
- **Clear History**: A trash icon in the chat header allows clearing all chat history for the current module.
- **Suggested Questions**: When the chat is empty, three starter questions are shown:
  - "Summarize the key concepts"
  - "What should I focus on?"
  - "Explain the main takeaways"
- **Loading States**: Spinner shown while history loads; typing indicator shown while AI is generating a response.
- **Module-Scoped**: Chat history resets when navigating between modules. Each module has its own independent conversation thread.
- **Error Handling**: Graceful handling of rate limits (429), credit exhaustion (402), and network errors with toast notifications.

### Architecture
```
Client (ModuleChatPanel)
  │
  ├── POST /functions/v1/module-chat
  │     Body: { messages, moduleContext }
  │     Headers: Authorization: Bearer <anon-key>
  │
  └── Edge Function (module-chat/index.ts)
        │
        ├── Builds system prompt from moduleContext
        ├── Calls Lovable AI Gateway (google/gemini-3-flash-preview)
        └── Streams SSE response back to client
```

### System Prompt
The AI is instructed to:
- Act as a helpful onboarding assistant for the specific module
- Reference actual section content when answering
- Keep responses concise and focused on the module material
- Use markdown formatting (lists, bold, code blocks)
- Suggest related sections if the learner seems confused

### Database Schema
```sql
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_id text NOT NULL,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
-- RLS: Users can only SELECT, INSERT, DELETE their own messages
-- Index on (user_id, module_id, created_at) for efficient history loading
```

### Files
- `src/components/ModuleChatPanel.tsx` — Chat panel UI with streaming logic
- `supabase/functions/module-chat/index.ts` — Edge function proxying to Lovable AI Gateway
- `supabase/config.toml` — Edge function configuration (`verify_jwt = false`)

---

## 7. Learner Notes

### Overview
Learners can take personal notes on each section, with optional guided prompts. Notes are persisted to the database.

### Features
- **Per-Section Notes**: Each section has its own notes panel accessible via a toggle button.
- **Note Prompts**: Sections can define `note_prompts` — clickable chips that append pre-written prompts to the notes textarea to guide reflection.
- **Save & Delete**: Notes can be saved and deleted. Save is disabled when content hasn't changed (dirty tracking).
- **Persistence**: Notes are stored in the `learner_notes` table with `user_id`, `module_id`, `section_id`, and `content`.
- **Animated Panel**: The notes editor slides in/out with framer-motion animations.

### Files
- `src/components/NotesPanel.tsx` — Notes editor component
- `src/hooks/useNotes.ts` — Notes CRUD hook

---

## 8. Glossary

### Overview
A searchable, filterable glossary of technical terms relevant to the onboarding content.

### Features
- **Search**: Real-time text search filtering terms by name or definition.
- **Track Filtering**: Filter glossary terms by role track (frontend, backend, infra, cross-repo).
- **Term Cards**: Each term displays:
  - Term name
  - Definition
  - Context/usage notes
  - Applicable track badges
- **Alphabetical Sorting**: Results are sorted alphabetically by term.
- **Empty State**: "No terms match" message when filters produce no results.
- **Animated Cards**: Smooth entry animations for term cards.

### Files
- `src/pages/GlossaryPage.tsx` — Glossary page
- `src/data/glossary-data.ts` — Glossary term data

---

## 9. Onboarding Paths (Checklists)

### Overview
Structured onboarding checklists organized into **Day 1** and **Week 1** paths with step-by-step guidance.

### Features
- **Tabbed View**: Two tabs — "Day 1" and "Week 1" — each showing progress percentage.
- **Step Cards**: Each step shows:
  - Title and description
  - Check/uncheck toggle
  - Optional track badge
  - Time estimate
  - Nested sub-steps
  - Success criteria badges
- **Progress Tracking**: Local state tracks which steps are checked; progress percentage updates in real-time in the tab headers.
- **Animated Cards**: Staggered framer-motion animations for card entry.

### Files
- `src/pages/PathsPage.tsx` — Paths page
- `src/data/paths-data.ts` — Path/step data

---

## 10. Ask Your Lead

### Overview
A curated list of high-signal questions that new hires should ask their team lead during onboarding.

### Features
- **Category Filtering**: Filter questions by category:
  - All / Team / Technical / Process / Culture
- **Track Filtering**: Filter by role track.
- **Question Cards**: Each question shows:
  - The question text
  - "Why it matters" explanation
  - Optional track badge
  - Check/uncheck toggle to mark as "asked"
- **Progress Counter**: Shows "X of Y asked" count.
- **Animated Cards**: Smooth entry animations.

### Files
- `src/pages/AskLeadPage.tsx` — Ask Lead page
- `src/data/ask-lead-data.ts` — Question data

---

## 11. Settings & Preferences

### Overview
User settings page for configuring learning preferences and managing progress data.

### Features
- **Audience Profile**: Choose your role context:
  - Technical / Non-Technical / Mixed
  - Persisted to `audience_preferences` table
- **Content Depth**: Choose how deep content should go:
  - Shallow / Standard / Deep
  - Persisted to `audience_preferences` table
- **Reset All Progress**: Destructive action that clears:
  - All reading progress (`user_progress`)
  - All quiz scores (`quiz_scores`)
  - All learner notes (`learner_notes`)
  - Invalidates all related React Query caches
- **Toast Feedback**: Success/error toasts for all actions.

### Files
- `src/pages/SettingsPage.tsx` — Settings page
- `src/hooks/useAudiencePrefs.ts` — Audience preferences hook

---

## 12. Sidebar Navigation

### Overview
A collapsible left sidebar providing primary navigation across all app sections.

### Features
- **Navigation Links**: Dashboard, Modules, Glossary, Paths, Ask Your Lead, Settings — each with a Lucide icon.
- **Active State**: Current route is highlighted with distinct styling and a chevron indicator.
- **Collapsible**: Sidebar can be collapsed to icon-only mode.
- **User Info**: Shows the logged-in user's email in the footer (when expanded).
- **Sign Out**: Sign-out button in the footer.
- **Version Label**: Shows "v4.0 • RocketBoard" in the footer.
- **Branding**: Rocket icon + "RocketBoard" text in the header.

### Files
- `src/components/AppSidebar.tsx` — Sidebar component
- `src/components/NavLink.tsx` — Navigation link component
- `src/components/DashboardLayout.tsx` — Layout wrapper with sidebar

---

## 13. Data Architecture

### Static Data (Client-Side)
All learning content is defined as static TypeScript data:

| File | Contents |
|------|----------|
| `src/data/onboarding-data.ts` | 5 modules with sections, quizzes, endcaps, metadata |
| `src/data/glossary-data.ts` | Glossary terms with definitions and track tags |
| `src/data/paths-data.ts` | Day 1 and Week 1 onboarding path steps |
| `src/data/ask-lead-data.ts` | 12 curated questions for team leads |

### Dynamic Data (Database-Persisted)
User-specific state is stored in the database:

| Table | Purpose |
|-------|---------|
| `user_progress` | Section read/unread state per user per module |
| `quiz_scores` | Quiz results per user per module |
| `learner_notes` | Personal notes per user per section |
| `chat_messages` | AI chat history per user per module |
| `audience_preferences` | User's audience profile and content depth preferences |
| `learner_state` | Last opened module/track for resume functionality |
| `profiles` | User display name and avatar |

---

## 14. Backend & Database

### Database (Lovable Cloud)
- **PostgreSQL** database with Row Level Security (RLS) on all tables.
- Every table's RLS policies ensure users can only access their own data (`auth.uid() = user_id`).
- Indexed for performance (e.g., `chat_messages` has a composite index on `(user_id, module_id, created_at)`).

### Edge Functions
- **`module-chat`**: Handles AI chat requests. Accepts messages + module context, builds a system prompt, streams responses from the Lovable AI Gateway using `google/gemini-3-flash-preview`. Configured with `verify_jwt = false` for simplified access.

### Authentication
- Supabase Auth with email/password sign-up and sign-in.
- Email verification required before account activation.
- Session tokens automatically refreshed.

---

## 15. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React 18 + TypeScript |
| **Build Tool** | Vite |
| **Styling** | Tailwind CSS + shadcn/ui components |
| **Animations** | Framer Motion |
| **State Management** | TanStack React Query (server state) + React useState (local state) |
| **Routing** | React Router v6 |
| **Charts** | Recharts |
| **Markdown** | react-markdown |
| **Icons** | Lucide React |
| **Backend** | Lovable Cloud (Supabase) — PostgreSQL, Auth, Edge Functions |
| **AI** | Lovable AI Gateway → Google Gemini 3 Flash Preview |
| **Testing** | Vitest + React Testing Library |
| **Forms** | React Hook Form + Zod validation |
| **Notifications** | Sonner (toast notifications) |

---

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/              # shadcn/ui primitives (button, card, tabs, etc.)
│   ├── AppSidebar.tsx   # Main navigation sidebar
│   ├── DashboardLayout.tsx
│   ├── ModuleCard.tsx
│   ├── ModuleChatPanel.tsx  # AI chat panel
│   ├── NavLink.tsx
│   ├── NotesPanel.tsx
│   ├── ProgressChart.tsx
│   ├── QuizRunner.tsx
│   ├── SectionViewer.tsx
│   ├── StatsStrip.tsx
│   └── TrackBadge.tsx
├── data/                # Static content data
│   ├── onboarding-data.ts
│   ├── glossary-data.ts
│   ├── paths-data.ts
│   └── ask-lead-data.ts
├── hooks/               # Custom React hooks
│   ├── useAuth.tsx
│   ├── useProgress.ts
│   ├── useNotes.ts
│   ├── useLearnerState.ts
│   ├── useAudiencePrefs.ts
│   └── use-mobile.tsx
├── integrations/        # Auto-generated Supabase client & types
├── pages/               # Route-level page components
│   ├── Index.tsx        # Dashboard
│   ├── Modules.tsx      # Module list
│   ├── ModuleView.tsx   # Module detail
│   ├── AuthPage.tsx     # Login/signup
│   ├── GlossaryPage.tsx
│   ├── PathsPage.tsx
│   ├── AskLeadPage.tsx
│   ├── SettingsPage.tsx
│   └── NotFound.tsx
├── App.tsx              # Root with routing & providers
└── main.tsx             # Entry point

supabase/
├── functions/
│   └── module-chat/     # AI chat edge function
│       └── index.ts
├── migrations/          # Database migrations
└── config.toml          # Supabase configuration
```
