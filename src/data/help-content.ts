export type HelpCategory =
  | "getting-started"
  | "sources"
  | "content-creation"
  | "learning"
  | "collaboration"
  | "settings"
  | "troubleshooting"
  | "keyboard-shortcuts"
  | "whats-new";

export type HelpArticle = {
  id: string;
  slug: string;
  title: string;
  category: HelpCategory;
  audience: ("admin" | "author" | "learner" | "all")[];
  tags: string[];
  summary: string;
  content: string;
  relatedArticles?: string[];
  lastUpdated: string;
};

export const HELP_CATEGORY_META: Record<HelpCategory, { icon: string; label: string }> = {
  "getting-started": { icon: "🚀", label: "Getting Started" },
  sources: { icon: "📦", label: "Sources" },
  "content-creation": { icon: "✏️", label: "Content Creation" },
  learning: { icon: "📚", label: "Learning" },
  collaboration: { icon: "👥", label: "Collaboration" },
  settings: { icon: "⚙️", label: "Settings" },
  troubleshooting: { icon: "🔧", label: "Troubleshooting" },
  "keyboard-shortcuts": { icon: "⌨️", label: "Shortcuts" },
  "whats-new": { icon: "✨", label: "What's New" },
};

export const HELP_ARTICLES: HelpArticle[] = [
  // ─── GETTING STARTED ─────────────────────────────
  {
    id: "gs-1",
    slug: "what-is-rocketboard",
    title: "What is RocketBoard?",
    category: "getting-started",
    audience: ["all"],
    tags: ["overview", "introduction", "platform"],
    summary: "Overview of the platform — what it does, who it's for.",
    lastUpdated: "2026-03-01",
    content: `# What is RocketBoard?

RocketBoard is an **AI-powered developer onboarding platform** that transforms your codebase, documentation, and internal knowledge into structured, interactive learning experiences.

## Who is it for?

- **Pack Owners/Admins** — create and manage onboarding packs
- **Authors** — curate sources, review generated content, and publish modules
- **Learners** — read modules, take quizzes, complete exercises, and ramp up faster

## The 6-Phase Flow

1. **Setup** — Create an organization and pack, invite team members
2. **Ingestion** — Connect sources (GitHub, Confluence, Notion, etc.)
3. **Planning** — AI generates a module plan; you curate and approve
4. **Generation** — AI creates modules, quizzes, exercises, glossary, paths, and ask-lead questions
5. **Learning** — Learners read, quiz, discuss, and track progress
6. **Iteration** — Re-sync sources, refresh stale content, refine modules`,
    relatedArticles: ["gs-2", "gs-3"],
  },
  {
    id: "gs-2",
    slug: "six-phase-flow",
    title: "The 6-Phase Setup Flow",
    category: "getting-started",
    audience: ["admin", "author"],
    tags: ["setup", "workflow", "phases"],
    summary: "Step-by-step walkthrough of the complete RocketBoard setup flow.",
    lastUpdated: "2026-03-01",
    content: `# The 6-Phase Setup Flow

## Phase 1: Setup
Create your organization and your first pack. Invite team members and assign roles (Owner, Admin, Author, Learner, Read Only).

## Phase 2: Ingestion
Connect your knowledge sources. Supported: GitHub repos, Confluence, Notion, Google Drive, SharePoint, Jira, Linear, OpenAPI specs, Postman collections, Figma, Slack channels, Loom videos, PagerDuty, and direct document uploads.

## Phase 3: Planning
Click **Generate Plan** to have the AI analyze your sources. Review detected signals, proposed tracks, and modules. Edit, reorder, add, or remove. Set prerequisites. Approve when ready.

## Phase 4: Generation
Generate all content in one cascade: modules → quizzes → exercises → glossary → paths → ask-lead questions. All content starts as **draft**.

## Phase 5: Learning
Learners read modules, take quizzes, complete exercises, explore the glossary, follow onboarding paths, and track milestones.

## Phase 6: Iteration
Re-sync sources when code changes. Check Content Health for stale content. Refine or regenerate modules as needed.`,
    relatedArticles: ["gs-1", "src-1"],
  },
  {
    id: "gs-3",
    slug: "quick-start-learners",
    title: "Quick Start for Learners",
    category: "getting-started",
    audience: ["learner", "all"],
    tags: ["quickstart", "learner", "beginner"],
    summary: "Get started as a learner in under 5 minutes.",
    lastUpdated: "2026-03-01",
    content: `# Quick Start for Learners

Welcome! Here's how to get started:

1. **Check your Dashboard** — See your assigned modules and progress
2. **Follow Paths** — Start with the Day 1 path for setup instructions
3. **Read Modules** — Open a module and read through sections, marking each as complete
4. **Take Quizzes** — Test your understanding after reading
5. **Use Bookmarks** — Save important sections with the 🔖 icon
6. **Ask the AI** — Click the 🚀 Rocket button to ask questions about module content
7. **Meet Your Team** — Check the Team Directory and schedule 1:1s

### Tips
- Press **Cmd+K** (Mac) or **Ctrl+K** to search anything
- Use **Simplify** on complex sections to get a simpler explanation
- Check the **Glossary** when you encounter unfamiliar terms`,
    relatedArticles: ["gs-1", "learn-1"],
  },
  {
    id: "gs-4",
    slug: "quick-start-admins",
    title: "Quick Start for Admins & Authors",
    category: "getting-started",
    audience: ["admin", "author"],
    tags: ["quickstart", "admin", "author"],
    summary: "Set up your first pack and generate content.",
    lastUpdated: "2026-03-01",
    content: `# Quick Start for Admins & Authors

1. **Create a Pack** — Name it after your team or project
2. **Add Sources** — Connect your GitHub repo or upload documents
3. **Generate a Plan** — Let the AI propose modules based on your sources
4. **Curate the Plan** — Edit, reorder, set prerequisites
5. **Generate Content** — Click "Generate All" to create modules, quizzes, glossary, etc.
6. **Review & Publish** — Check each module, refine if needed, then publish
7. **Invite Learners** — Add team members via email from the Members page`,
    relatedArticles: ["gs-2", "src-1"],
  },
  {
    id: "gs-5",
    slug: "understanding-roles",
    title: "Understanding Roles & Permissions",
    category: "getting-started",
    audience: ["all"],
    tags: ["roles", "permissions", "access"],
    summary: "What each role can do in RocketBoard.",
    lastUpdated: "2026-03-01",
    content: `# Understanding Roles & Permissions

| Feature | Owner | Admin | Author | Learner | Read Only |
|---------|-------|-------|--------|---------|-----------|
| View content | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read modules & quizzes | ✅ | ✅ | ✅ | ✅ | ✅ |
| Take quizzes & exercises | ✅ | ✅ | ✅ | ✅ | ❌ |
| Post discussions | ✅ | ✅ | ✅ | ✅ | ❌ |
| Save bookmarks & notes | ✅ | ✅ | ✅ | ✅ | ❌ |
| Manage sources | ✅ | ✅ | ✅ | ❌ | ❌ |
| Generate & edit content | ✅ | ✅ | ✅ | ❌ | ❌ |
| Manage members | ✅ | ✅ | ❌ | ❌ | ❌ |
| View analytics | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete pack | ✅ | ❌ | ❌ | ❌ | ❌ |`,
    relatedArticles: ["gs-1", "set-1"],
  },

  // ─── SOURCES ─────────────────────────────────────
  {
    id: "src-1",
    slug: "connecting-github",
    title: "Connecting GitHub Repositories",
    category: "sources",
    audience: ["admin", "author"],
    tags: ["github", "source", "repository", "ingestion"],
    summary: "How to add and sync a GitHub repository.",
    lastUpdated: "2026-03-01",
    content: `# Connecting GitHub Repositories

1. Go to **Sources** page
2. Click **Add Source** and select **GitHub Repository**
3. Enter the full repository URL (e.g., \`https://github.com/org/repo\`)
4. Click **Add Source**
5. Click **Sync** on the source card to start ingestion

[ACTION: connect_github(Add a GitHub Repo Now)]

### What gets ingested
Supported file types: \`.ts\`, \`.tsx\`, \`.js\`, \`.jsx\`, \`.md\`, \`.json\`, \`.yaml\`, \`.yml\`, \`.py\`, \`.go\`, \`.rs\`, \`.java\`, \`.rb\`, \`.sh\`, \`.css\`, \`.html\`, \`.sql\`, \`.tf\`, Dockerfile, Makefile, and more.

### Security
Secrets (API keys, passwords, tokens) are automatically **redacted** during ingestion to prevent sensitive data from appearing in generated content.`,
    relatedArticles: ["src-7", "ts-1"],
  },
  {
    id: "src-2",
    slug: "connecting-confluence",
    title: "Connecting Confluence",
    category: "sources",
    audience: ["admin", "author"],
    tags: ["confluence", "wiki", "source"],
    summary: "How to ingest Confluence wiki spaces.",
    lastUpdated: "2026-03-01",
    content: `# Connecting Confluence

1. Go to **Sources** → **Add Source** → **Confluence**
2. Enter your Confluence base URL, space key, and email
3. Provide an API token (generate one from Atlassian account settings)
4. Click **Add Source** then **Sync**

Pages from your space will be ingested as knowledge chunks.`,
    relatedArticles: ["src-1", "src-7"],
  },
  {
    id: "src-3",
    slug: "connecting-notion",
    title: "Connecting Notion",
    category: "sources",
    audience: ["admin", "author"],
    tags: ["notion", "source", "wiki"],
    summary: "How to ingest Notion pages and databases.",
    lastUpdated: "2026-03-01",
    content: `# Connecting Notion

1. Go to **Sources** → **Add Source** → **Notion**
2. Enter the Notion page URL and your integration token
3. Make sure the Notion integration has access to the pages you want to ingest
4. Click **Add Source** then **Sync**`,
    relatedArticles: ["src-1", "src-7"],
  },
  {
    id: "src-4",
    slug: "uploading-documents",
    title: "Uploading Documents",
    category: "sources",
    audience: ["admin", "author"],
    tags: ["upload", "document", "pdf", "docx"],
    summary: "How to upload PDF, DOCX, XLSX and other files.",
    lastUpdated: "2026-03-01",
    content: `# Uploading Documents

## Supported Formats
PDF, DOCX, XLSX, PPTX, MD, TXT, CSV, HTML, JSON, YAML

## How to Upload
1. Go to **Sources** → **Add Source** → **Document**
2. Choose **Upload** tab
3. Drag & drop files or click to browse
4. Up to 20 files at once, max 50MB per file

## URL Import
Choose the **URL** tab to import from a public URL. Use **Crawl mode** to follow internal links.`,
    relatedArticles: ["src-7", "src-1"],
  },
  {
    id: "src-7",
    slug: "understanding-chunks",
    title: "Understanding Knowledge Chunks",
    category: "sources",
    audience: ["admin", "author"],
    tags: ["chunks", "knowledge", "ingestion"],
    summary: "What chunks are and how they're used.",
    lastUpdated: "2026-03-01",
    content: `# Understanding Knowledge Chunks

Knowledge chunks are small segments of your source content (~100-150 lines of code or ~500 words of text).

## Why Chunking?
The AI uses chunks as **evidence** when generating content. Smaller chunks allow more precise citations.

## Browsing Chunks
Click **Browse Chunks** on any source card to view the individual text segments.

## Redacted Content
Secrets (API keys, tokens, passwords) are automatically replaced with \`***REDACTED***\` during ingestion.`,
    relatedArticles: ["src-1", "src-4"],
  },

  // ─── CONTENT CREATION ────────────────────────────
  {
    id: "cc-1",
    slug: "generating-module-plan",
    title: "Generating a Module Plan",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["plan", "modules", "generation", "signals"],
    summary: "How the AI proposes modules and how to curate the plan.",
    lastUpdated: "2026-03-01",
    content: `# Generating a Module Plan

1. Go to the **Plan** page
2. Click **Generate Plan**
3. The AI analyzes your sources and proposes modules

[ACTION: generate_plan(Generate Plan from Sources)]

## What You Can Do
- **Edit** titles and descriptions inline
- **Reorder** modules by dragging
- **Add** custom modules
- **Remove** modules you don't need
- Set **prerequisites** between modules
- Assign **tracks** and **templates**

## Approving
Click **Approve Plan** when ready. This enables content generation.`,
    relatedArticles: ["cc-2", "cc-3"],
  },
  {
    id: "cc-2",
    slug: "content-generation",
    title: "Content Generation Cascade",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["generation", "cascade", "modules", "quiz"],
    summary: "What happens when you click Generate All Content.",
    lastUpdated: "2026-03-01",
    content: `# Content Generation Cascade

When you click **Generate All**, content is created in sequence:

1. **Modules** — Learning content with sections, code snippets, citations
2. **Quizzes** — Multiple-choice questions per module
3. **Exercises** — Hands-on coding challenges
4. **Glossary** — Searchable terms with definitions
5. **Paths** — Day 1 and Week 1 onboarding checklists
6. **Ask-Lead** — Curated questions to ask your team lead

All content starts as **draft**. If one item fails, others continue.`,
    relatedArticles: ["cc-1", "cc-3"],
  },
  {
    id: "cc-3",
    slug: "reviewing-publishing",
    title: "Reviewing and Publishing Content",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["review", "publish", "draft", "refine"],
    summary: "How to review, refine, and publish generated content.",
    lastUpdated: "2026-03-01",
    content: `# Reviewing and Publishing

## Review Page
- Preview each module as learners will see it
- Check for contradictions and warnings
- View generation stats

## Refining
Click **Refine** and describe changes in natural language3. Profit! The AI updates the module and shows what changed.

[ACTION: open_sandbox(Try it in the Sandbox)]

## Publishing
Click **Publish Pack** to make all draft content visible to learners. You can continue editing and re-publishing after.`,
    relatedArticles: ["cc-1", "cc-5"],
  },
  {
    id: "cc-4",
    slug: "module-templates",
    title: "Module Templates",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["templates", "blueprint", "structure"],
    summary: "How to create and use templates for standardized module structures.",
    lastUpdated: "2026-03-01",
    content: `# Module Templates

Templates are reusable blueprints that define a standard section structure. Assign templates to modules before generation.

## Creating Templates
Go to **Templates** page and create a new template with your desired section structure.

## Assigning Templates
On the Plan page, select a template from the dropdown on each module card.`,
    relatedArticles: ["cc-1"],
  },
  {
    id: "cc-5",
    slug: "citations-evidence",
    title: "Understanding Citations and Evidence",
    category: "content-creation",
    audience: ["all"],
    tags: ["citations", "evidence", "source code", "spans"],
    summary: "How AI content is grounded in your actual source code.",
    lastUpdated: "2026-03-01",
    content: `# Understanding Citations and Evidence

Generated content includes **citation badges** (e.g., [S1], [S2]) linking to actual source files.

## How to Use
- **Click** a badge to view the original source with syntax highlighting
- **Hover** for a quick preview
- Open **Code Explorer** to browse all referenced files

Citations ensure generated content is accurate and traceable.`,
    relatedArticles: ["cc-3", "src-7"],
  },
  {
    id: "cc-6",
    slug: "prerequisites",
    title: "Setting Prerequisites Between Modules",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["prerequisites", "dependencies", "ordering"],
    summary: "How to control module ordering with dependencies.",
    lastUpdated: "2026-03-01",
    content: `# Setting Prerequisites

## Hard Prerequisites
The module is **locked** until the prerequisite is completed. Learners cannot access it.

## Soft Prerequisites
A **recommendation** is shown, but learners can proceed anyway.

## Configuration
- **Min Completion %** — How much of the prerequisite must be read (default: 100%)
- **Min Quiz Score** — Minimum quiz score required (set to 0 to skip)

View the **Dependency Graph** to visualize all prerequisite relationships.`,
    relatedArticles: ["cc-1"],
  },
  {
    id: "cc-7",
    slug: "content-health",
    title: "Content Health and Freshness",
    category: "content-creation",
    audience: ["admin", "author"],
    tags: ["freshness", "stale", "content health"],
    summary: "How to keep generated content up-to-date.",
    lastUpdated: "2026-03-01",
    content: `# Content Health and Freshness

The Content Health page shows which modules reference **changed source files**.

## Freshness Score
Percentage of cited chunks that still match their original content. 100% = all sources unchanged.

## Fixing Stale Content
1. Re-sync the source to update chunks
2. Regenerate or refine affected modules
3. Check the diff to see what changed`,
    relatedArticles: ["cc-3", "src-1"],
  },

  // ─── LEARNING ────────────────────────────────────
  {
    id: "learn-1",
    slug: "reading-modules",
    title: "Reading Modules",
    category: "learning",
    audience: ["learner", "all"],
    tags: ["modules", "reading", "progress", "notes"],
    summary: "How to read content, take notes, and track progress.",
    lastUpdated: "2026-03-01",
    content: `# Reading Modules

## Navigation
Expand each section to read. Use the section mini-map on the side for quick navigation.

## Mark as Read
Click the button to mark a section as completed. Progress is saved instantly.

## Taking Notes
Open the notes panel for guided reflection prompts. Notes are always private.

## Bookmarks
Click the 🔖 icon to save any section. Access from the Saved page.

## Simplify
Click **Simplify** for a simpler version of complex sections.`,
    relatedArticles: ["learn-2", "gs-3"],
  },
  {
    id: "learn-2",
    slug: "taking-quizzes",
    title: "Taking Quizzes",
    category: "learning",
    audience: ["learner", "all"],
    tags: ["quiz", "assessment", "score"],
    summary: "How quizzes work, scoring, and retaking.",
    lastUpdated: "2026-03-01",
    content: `# Taking Quizzes

Quizzes are multiple-choice assessments at the end of each module.

## How It Works
- Answer each question and get immediate feedback
- Explanations include code references
- Your score is saved automatically

## Retaking
You can retake any quiz. Your most recent score is what counts.

## Areas to Review
After the quiz, you'll see which sections to revisit based on incorrect answers.`,
    relatedArticles: ["learn-1", "learn-3"],
  },
  {
    id: "learn-3",
    slug: "exercises",
    title: "Completing Exercises",
    category: "learning",
    audience: ["learner", "all"],
    tags: ["exercises", "coding", "hands-on"],
    summary: "How hands-on exercises work.",
    lastUpdated: "2026-03-01",
    content: `# Completing Exercises

Exercises are hands-on challenges that test practical skills.

## Types
- **Code Find** — Locate specific code patterns
- **Explain** — Write explanations of code behavior
- **Config** — Configure a setting or tool
- **Debug** — Find and fix issues
- **Explore** — Investigate the codebase

## Hints
Use progressive hints if you're stuck. Each hint is more specific. Hint usage is tracked but doesn't affect scoring.

## AI Review
Submit your answer for AI feedback with a score and suggestions.`,
    relatedArticles: ["learn-1", "learn-2"],
  },
  {
    id: "learn-4",
    slug: "ai-chat",
    title: "Using AI Chat (Rocket & Mission Control)",
    category: "learning",
    audience: ["all"],
    tags: ["chat", "ai", "rocket", "mission control"],
    summary: "Two AI assistants — module-specific and platform-wide.",
    lastUpdated: "2026-03-01",
    content: `# Using AI Chat

## 🚀 Rocket (Module Chat)
- Available on module pages (bottom-right)
- Answers questions about the current module's content
- Responses include citations to source code
- Best for: "How does the auth flow work?" or "Explain this code"

## 🧭 Mission Control (Global Chat)
- Available on all pages (bottom-left)
- Answers questions about RocketBoard's features
- Best for: "How do I bookmark something?" or "What keyboard shortcuts are available?"`,
    relatedArticles: ["learn-1", "gs-3"],
  },
  {
    id: "learn-5",
    slug: "onboarding-paths",
    title: "Onboarding Paths (Day 1 & Week 1)",
    category: "learning",
    audience: ["learner", "all"],
    tags: ["paths", "day1", "week1", "checklist"],
    summary: "How to use the structured checklists.",
    lastUpdated: "2026-03-01",
    content: `# Onboarding Paths

## Day 1
Focus on environment setup, access requests, and meeting your immediate team.

## Week 1
Deeper exploration: complete initial modules, understand team workflows, and explore the codebase.

## Tracking Progress
Check off steps as you complete them. Progress is saved automatically.`,
    relatedArticles: ["gs-3", "learn-1"],
  },
  {
    id: "learn-6",
    slug: "glossary-flashcards",
    title: "Glossary and Flashcards",
    category: "learning",
    audience: ["all"],
    tags: ["glossary", "flashcards", "terms"],
    summary: "How to use the searchable glossary and flashcard mode.",
    lastUpdated: "2026-03-01",
    content: `# Glossary and Flashcards

## Glossary
Search and filter terms by name, definition, or track. Each term includes context and code examples.

## Flashcard Mode
Practice terms with flip cards for memorization. Great for reviewing before quizzes.`,
    relatedArticles: ["learn-1"],
  },
  {
    id: "learn-7",
    slug: "spaced-repetition",
    title: "Spaced Repetition Reviews",
    category: "learning",
    audience: ["learner", "all"],
    tags: ["review", "spaced repetition", "retention"],
    summary: "How review reminders help with long-term retention.",
    lastUpdated: "2026-03-01",
    content: `# Spaced Repetition Reviews

Completed modules are scheduled for review at increasing intervals: 3 days, 1 week, 2 weeks, 1 month.

## How It Works
- Enable in Settings
- You'll see review prompts on your dashboard
- Quick review sessions with self-rating
- Helps cement knowledge long-term`,
    relatedArticles: ["learn-1"],
  },

  // ─── COLLABORATION ───────────────────────────────
  {
    id: "collab-1",
    slug: "team-directory",
    title: "Team Directory",
    category: "collaboration",
    audience: ["all"],
    tags: ["team", "directory", "meetings"],
    summary: "Finding and meeting your team members.",
    lastUpdated: "2026-03-01",
    content: `# Team Directory

Team members are auto-detected from source files (CODEOWNERS, Git commits, etc.) and can be manually added.

## Meeting Tracking
Check off each person as you have 1:1 conversations. Suggested topics help you have productive meetings.`,
    relatedArticles: ["collab-2"],
  },
  {
    id: "collab-2",
    slug: "discussions",
    title: "Discussions and Peer Learning",
    category: "collaboration",
    audience: ["all"],
    tags: ["discussions", "questions", "tips", "threads"],
    summary: "How to ask questions, share tips, and learn with peers.",
    lastUpdated: "2026-03-01",
    content: `# Discussions

## Thread Types
- **Discussion** — general conversation
- **Question** — can be marked as resolved with an accepted answer
- **Tip** — helpful insights for other learners

## Features
- Upvote helpful posts
- Pin important threads
- Filter by module or type`,
    relatedArticles: ["collab-1"],
  },
  {
    id: "collab-3",
    slug: "cohorts",
    title: "Cohorts",
    category: "collaboration",
    audience: ["all"],
    tags: ["cohorts", "groups", "peers"],
    summary: "How cohort groups work for tracking peer progress.",
    lastUpdated: "2026-03-01",
    content: `# Cohorts

Cohorts are groups of learners who started onboarding around the same time.

## Features
- See peer progress (respecting privacy settings)
- Admins can create and manage cohorts
- Cohort members can see each other's completion status`,
    relatedArticles: ["collab-1"],
  },
  {
    id: "collab-4",
    slug: "ask-your-lead",
    title: "Ask Your Lead",
    category: "collaboration",
    audience: ["learner", "all"],
    tags: ["ask lead", "questions", "team lead"],
    summary: "Curated questions to ask your team lead.",
    lastUpdated: "2026-03-01",
    content: `# Ask Your Lead

AI-generated questions to ask your team lead during onboarding. Topics cover architecture decisions, team processes, and project context.

Track which questions you've asked and mark them complete.`,
    relatedArticles: ["collab-1"],
  },

  // ─── SETTINGS ────────────────────────────────────
  {
    id: "set-1",
    slug: "personalizing-experience",
    title: "Personalizing Your Experience",
    category: "settings",
    audience: ["all"],
    tags: ["settings", "preferences", "personalization"],
    summary: "All the ways to customize RocketBoard.",
    lastUpdated: "2026-03-01",
    content: `# Personalizing Your Experience

## Audience Profile
- **Technical** — code and implementation details
- **Non-Technical** — concepts and workflows
- **Mixed** — balanced approach

## Content Depth
- **Shallow** — quick overviews
- **Standard** — balanced
- **Deep** — comprehensive with edge cases

## Other Settings
- Language preference
- Theme (Light/Dark/System)
- Glossary density
- Spaced repetition
- Peer privacy`,
    relatedArticles: ["set-2", "gs-5"],
  },
  {
    id: "set-2",
    slug: "generation-limits",
    title: "Generation Limits Explained",
    category: "settings",
    audience: ["admin", "author"],
    tags: ["limits", "generation", "words", "quiz"],
    summary: "What each generation limit controls.",
    lastUpdated: "2026-03-01",
    content: `# Generation Limits

## Max Module Words
Hard limit — the AI will not exceed this. Default: 1400 words.

## Max Quiz Questions
Maximum questions per module quiz. Default: 5.

## Max Key Takeaways
Maximum takeaway points per module. Default: 5.

Adjust these on the Settings page to control content size.`,
    relatedArticles: ["set-1"],
  },
  {
    id: "set-3",
    slug: "access-levels",
    title: "Understanding Access Levels",
    category: "settings",
    audience: ["all"],
    tags: ["roles", "access", "permissions"],
    summary: "What each role can and cannot do.",
    lastUpdated: "2026-03-01",
    content: `# Understanding Access Levels

See the [Roles & Permissions](/help/getting-started/understanding-roles) article for a full reference table.

## Quick Summary
- **Owner** — full control
- **Admin** — manage members, settings, content
- **Author** — create and edit content
- **Learner** — read, quiz, discuss
- **Read Only** — view only`,
    relatedArticles: ["gs-5"],
  },

  // ─── TROUBLESHOOTING ─────────────────────────────
  {
    id: "ts-1",
    slug: "ingestion-failed",
    title: "Source Ingestion Failed",
    category: "troubleshooting",
    audience: ["admin", "author"],
    tags: ["error", "ingestion", "github", "source"],
    summary: "Common reasons ingestion fails and how to fix them.",
    lastUpdated: "2026-03-01",
    content: `# Source Ingestion Failed

## Common Causes
- **GitHub** — Repository not found (check URL), rate limited (wait and retry)
- **Confluence** — Invalid API token, space not found
- **Notion** — Integration not shared with pages
- **General** — Network errors, timeout

## Steps to Fix
1. Verify the source URL/credentials
2. Wait a few minutes and retry
3. Check if the source is accessible from a browser
4. Try removing and re-adding the source`,
    relatedArticles: ["src-1", "ts-2"],
  },
  {
    id: "ts-2",
    slug: "ai-generation-errors",
    title: "AI Generation Errors",
    category: "troubleshooting",
    audience: ["admin", "author"],
    tags: ["error", "ai", "generation", "rate limit"],
    summary: "Understanding and resolving AI error messages.",
    lastUpdated: "2026-03-01",
    content: `# AI Generation Errors

## Error Types
- **Insufficient Evidence** — Add more sources, the AI doesn't have enough data
- **Rate Limited** — Wait 30 seconds and retry
- **Credit Exhausted** — Contact your admin
- **Invalid Output** — Retry; if persistent, report the issue
- **Network Error** — Check your connection`,
    relatedArticles: ["ts-1", "ts-3"],
  },
  {
    id: "ts-3",
    slug: "content-wrong-outdated",
    title: "Content Looks Wrong or Outdated",
    category: "troubleshooting",
    audience: ["all"],
    tags: ["stale", "wrong", "outdated", "refresh"],
    summary: "What to do when generated content doesn't match your code.",
    lastUpdated: "2026-03-01",
    content: `# Content Looks Wrong or Outdated

1. Check the **Content Health** page for stale indicators
2. **Re-sync** the source to update knowledge chunks
3. **Refine** the module with specific instructions
4. Use the **feedback** button (🚩) to flag issues for authors`,
    relatedArticles: ["cc-7", "ts-2"],
  },
  {
    id: "ts-4",
    slug: "cant-access-feature",
    title: "Can't Access a Feature",
    category: "troubleshooting",
    audience: ["all"],
    tags: ["access", "permission", "locked"],
    summary: "Troubleshooting access and permission issues.",
    lastUpdated: "2026-03-01",
    content: `# Can't Access a Feature

1. Check your role on the Settings page
2. Contact your pack admin for elevated access
3. If a module is locked, complete its prerequisites first
4. Some features (Sources, Plan, Analytics) require Author or Admin roles`,
    relatedArticles: ["gs-5", "set-3"],
  },
  {
    id: "ts-5",
    slug: "quiz-questions-unfair",
    title: "Quiz Questions Are Unfair or Incorrect",
    category: "troubleshooting",
    audience: ["all"],
    tags: ["quiz", "feedback", "incorrect"],
    summary: "How to report and fix quiz quality issues.",
    lastUpdated: "2026-03-01",
    content: `# Quiz Questions Are Unfair or Incorrect

1. Use the **feedback** button after answering each question
2. Authors can review feedback and edit or regenerate questions
3. Check Quiz Analytics for questions with low correct rates`,
    relatedArticles: ["learn-2"],
  },

  // ─── KEYBOARD SHORTCUTS ──────────────────────────
  {
    id: "kb-1",
    slug: "keyboard-shortcuts",
    title: "Keyboard Shortcuts Reference",
    category: "keyboard-shortcuts",
    audience: ["all"],
    tags: ["keyboard", "shortcuts", "hotkeys"],
    summary: "All keyboard shortcuts in one place.",
    lastUpdated: "2026-03-01",
    content: `# Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Cmd/Ctrl + K** | Open global search |
| **Cmd/Ctrl + D** | Bookmark current content |
| **Escape** | Close modal, overlay, or search |
| **?** | Show keyboard shortcuts |
| **Arrow keys** | Navigate tour steps |
| **Tab** | Navigate between interactive elements |`,
    relatedArticles: [],
  },

  // ─── WHAT'S NEW ──────────────────────────────────
  {
    id: "wn-1",
    slug: "whats-new",
    title: "What's New in RocketBoard",
    category: "whats-new",
    audience: ["all"],
    tags: ["changelog", "updates", "new features"],
    summary: "Recent updates and new features.",
    lastUpdated: "2026-03-11",
    content: `# What's New in RocketBoard

## March 2026
- **Guided Tours** — Interactive walkthroughs for first-time users on every major page
- **Help Center** — Searchable in-app help with articles for every feature
- **Platform-Aware Mission Control** — Ask about RocketBoard features and get accurate answers
- **Help Tooltips** — Contextual ⓘ tooltips across the entire platform
- **Content Health Dashboard** — Track when source code changes affect generated content

## February 2026
- **Exercises** — Hands-on coding challenges with AI review
- **Spaced Repetition** — Review schedule for long-term retention
- **Cohorts** — Peer group progress tracking
- **Bookmarks & Collections** — Save and organize content`,
    relatedArticles: [],
  },
];
