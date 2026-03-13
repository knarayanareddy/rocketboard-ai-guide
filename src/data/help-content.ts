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

:::card[Pack Owners/Admins]{🛡️}
Create and manage the high-level onboarding strategy for your organization.
:::

:::card[Authors]{✍️}
Curate sources, review AI-generated content drafts, and publish educational modules.
:::

:::card[Learners]{🎓}
Read modules, take quizzes, complete exercises, and ramp up on new repos in record time.
:::

## The 6-Phase Flow

:::step[Setup]{1}
Create an organization and pack, then invite your engineering team.
:::

:::step[Ingestion]{2}
Connect sources like GitHub, Confluence, and Notion to ground your AI.
:::

:::step[Planning]{3}
AI generates a module plan; you curate the structure and approve the roadmap.
:::

:::step[Generation]{4}
AI creates modules, quizzes, exercises, and glossary terms automatically.
:::

:::step[Learning]{5}
Learners consume content, quiz themselves, and track their ramp-up progress.
:::

:::step[Iteration]{6}
Re-sync sources to detect staleness and approve AI-drafted content repairs.
:::`,
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

Getting your team ramped up on a new codebase follows this battle-tested six-phase journey.

:::step[Phase 1: Setup]
Create your organization and your first pack. Invite team members and assign roles (Owner, Admin, Author, Learner, Read Only).
:::

:::step[Phase 2: Ingestion]
Connect your knowledge sources. Supported: GitHub repos, Confluence, Notion, Google Drive, SharePoint, Jira, Linear, and more.
:::

:::step[Phase 3: Planning]
AI analyzes your sources to propose a module roadmap. Review detected signals, tracks, and prerequisites before approving.
:::

:::step[Phase 4: Generation]
Generate all content in one cascade: modules → quizzes → exercises → glossary → paths → ask-lead questions.
:::

:::step[Phase 5: Learning]
Learners read modules, take quizzes, complete exercises, explore the glossary, and track milestones on their dashboard.
:::

:::step[Phase 6: Iteration]
Re-sync sources when code changes. Check **Content Health** for stale indicators and approve AI-drafted remedies.
:::`,
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

Welcome! Here's how to get started in under 5 minutes.

:::step[1. Dashboard]
Open your **Dashboard** to see your assigned modules, onboarding paths, and overall progress.
:::

:::step[2. Follow Paths]
Start with your **Day 1 path** to get all your environment setup and team access sorted out.
:::

:::step[3. Read & Learn]
Open a module, read through sections, and mark them as complete. Use the **Simplify** button for tough concepts.
:::

:::step[4. Take Quizzes]
Test your knowledge at the end of each module. If you get stuck, use **Mission Control** to ask questions.
:::

:::card[Tips for Success]{💡}
- Press **Cmd+K** to search everything instantly
- Use **Rocket Chat** (🚀) on any module page to ask about the specific content
- Check the **Glossary** for unfamiliar team jargon
:::`,
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
    content: `# The RocketBoard Workflow

Getting the most out of RocketBoard follows a six-phase journey from raw code to a published onboarding experience.

:::step[1. Connect & Ingest]
Connect your GitHub repos or documentation wikis. RocketBoard's AI Agent parses the files and creates a semantic knowledge map.
:::

:::step[2. Curate the Plan]
Review the AI-generated module list. You can add sections, reorder topics, and set prerequisites to ensure a logical learning path.
:::

:::step[3. AI Content Generation]
Hit "Generate" and watch as the AI drafts deep-dives, code walkthroughs, and technical exercises based on your actual codebase.
:::

:::step[4. Review & Refine]
Review citations to ensure accuracy. If a section needs more detail, use the **Refine** button to chat with the AI and tweak the content.
:::

:::step[5. Publish & Onboard]
Publish your pack to make it visible to your team. Invite new hires and track their progress through the "Learner Insights" dashboard.
:::

:::step[6. Automated Maintenance]
As your code changes, RocketBoard detects staleness and drafts automated remediations for you to review and accept.
:::`,
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

RocketBoard uses a robust access control system to ensure everyone has the right level of power for their role.

:::card[Pack Owners & Admins]{🛡️}
Full control over the organization, packs, billing, and member invites.
:::

:::card[Authors]{✍️}
Strategic access to curate sources, generate content drafts, and publish educational modules.
:::

:::card[Learners]{🎓}
Pure consumption access to read modules, take quizzes, and track personal ramp-up milestones.
:::

## Permission Matrix

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

Ground your AI in your actual codebase by connecting your GitHub repositories.

:::step[1. Go to Sources]
Navigate to the **Sources** page from the sidebar.
:::

:::step[2. Add Repository]
Click **Add Source** and select **GitHub Repository**.
:::

:::step[3. Enter URL]
Paste the full repository URL (e.g., \`https://github.com/org/repo\`).
:::

:::step[4. Start Sync]
Click **Sync** on the source card. RocketBoard will begin parsing your code and creating embeddings.
:::

[ACTION: connect_github(Add a GitHub Repo Now)]

## Automated Safeguards

:::card[Security & Redaction]{🔒}
Secrets like API keys, passwords, and tokens are automatically **redacted** during ingestion to prevent exposure in generated modules.
:::

:::card[Supported Languages]{📁}
RocketBoard natively supports TypeScript, JavaScript, Python, Go, Rust, Java, and many more.
:::`,
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

Ground your AI in your Confluence wiki spaces and documentation pages.

:::step[1. Start Connection]
Go to **Sources** → **Add Source** and select **Confluence**.
:::

:::step[2. Provide Details]
Enter your Confluence base URL (e.g., \`https://org.atlassian.net/wiki\`) and the Space Key you wish to ingest.
:::

:::step[3. Authenticate]
Provide your email and a valid **API Token** (generate this from your Atlassian account security settings).
:::

:::step[4. Sync]
Click **Add Source** then **Sync**. RocketBoard will ingest pages from the space as knowledge chunks.
:::`,
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

Import your team's Notion pages and databases as primary knowledge sources.

:::step[1. Add Source]
Go to **Sources** → **Add Source** and select **Notion**.
:::

:::step[2. Credentials]
Enter the URL of the top-level Notion page and your Notion **Internal Integration Token**.
:::

:::step[3. Permissions]
Ensure that your Notion integration has been **invited** to the pages you wish to ingest.
:::

:::step[4. Start Ingestion]
Click **Add Source** then **Sync** to begin the knowledge mapping process.
:::`,
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

Boost your knowledge base by uploading legacy documentation and static files.

:::card[Supported Formats]{📄}
PDF, DOCX, XLSX, PPTX, MD, TXT, CSV, HTML, JSON, YAML
:::

:::step[1. Open Upload]
Go to **Sources** → **Add Source** → **Document** and choose the **Upload** tab.
:::

:::step[2. Select Files]
Drag & drop files or click to browse. You can upload up to 20 files at once (max 50MB per file).
:::

:::card[URL Import Strategy]{🔗}
Choose the **URL** tab to import from a public URL. Use **Crawl mode** to automatically follow internal links.
:::`,
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

Knowledge chunks are the atomic units of information in RocketBoard, typically representing ~100-150 lines of code or ~500 words of text.

:::card[Why Chunking?]{🧱}
The AI uses these segments as **evidence** when generating content. Smaller chunks allow for surgical precision in citations.
:::

:::card[Browsing Evidence]{🔍}
Click **Browse Chunks** on any source card to audit the individual text segments stored in the vector database.
:::

:::card[Privacy & Redaction]{🛡️}
Secrets (API keys, tokens, passwords) are automatically detected and replaced with \`***REDACTED***\` during the ingestion process.
:::`,
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

Turn raw code into a structured roadmap. The AI analyzes your source tree to propose a logical onboarding sequence.

:::step[1. Trigger Analysis]
Go to the **Plan** page and click **Generate Plan**. The AI will begin mapping "signals" to potential modules.
:::

[ACTION: generate_plan(Generate Plan from Sources)]

:::card[Curation Tools]{🛠️}
- **Edit & Reorder:** Tweak titles and drag modules into the right order.
- **Dependencies:** Set **prerequisites** to control the learner's journey.
- **Categorization:** Assign **tracks** (e.g., Backend, Frontend) and module **templates**.
:::

:::step[2. Approval]
Click **Approve Plan** once the roadmap looks right. This unlocks the full content generation cascade.
:::`,
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

One click to build an entire education track. When you click **Generate All**, RocketBoard triggers a multi-stage production sequence.

:::step[1. Knowledge Modules]
AI drafts the primary instructional content, complete with code walkthroughs and citations.
:::

:::step[2. Assessment & Practice]
Multiple-choice **Quizzes** and hands-on **Exercises** are drafted to validate learner understanding.
:::

:::step[3. Auxiliary Content]
The system populates a searchable **Glossary**, compiles **Onboarding Paths**, and prepares **Ask-Lead** questions.
:::

:::card[Draft Status]{📝}
All generated content starts as a **Draft**. Nothing is visible to learners until you explicitly hit **Publish**.
:::`,
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
- **Review AI Drafts:** If source code changed, review and accept automatically drafted updates.

## Refining
Click **Refine** and describe changes in natural language. The AI updates the module and shows what changed.

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
    content: `# Understanding Citations and Semantic Search

Generated content includes **citation badges** (e.g., [S1], [S2]) linking to actual source files, ensuring absolute accuracy and traceability to your codebase.

## Semantic Hybrid Search
    RocketBoard uses an advanced **AI Semantic Vector Search** (powered by \`pgvector\`) combined with full-text search.
When generating content or answering questions in Chat, the AI doesn't just look for exact keyword matches. It understands the *meaning* of the code and prioritizes the most authoritative files.

## Browsing Evidence
- **Click** a badge to view the original source with syntax highlighting
- **Hover** for a quick preview
- Open **Code Explorer** to browse all referenced files`,
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
    content: `# Content Health and Automated Remediation

The Content Health page shows which modules reference **changed source files**.

## Freshness Score
Percentage of cited chunks that still match their original content. 100% = all sources unchanged.

## Automated AI Remediation ✨
When RocketBoard detects a pushed change in GitHub that makes a module stale:
1. An AI Agent reads the raw git diff.
2. It drafts a precise update to the module text to reflect the code changes.
3. You will see a blue "Draft Update Available" badge on the **Review** page.
4. Review the Side-by-Side Diff and click **Accept Update** to instantly repair the module.

*(For sources without webhook integrations, you can fix stale content by clicking Re-Sync and refining the module manually).*`,
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

Dive into your curated learning content. RocketBoard modules are designed for focused, technical reading.

:::step[1. Section Map]
Use the interactive mini-map on the right to jump between concepts or track your vertical scroll progress.
:::

:::step[2. Code Explorer]
Click any citation badge to open the side-car code explorer. View the raw source file exactly as it exists in your repo.
:::

:::card[Toolbox]{🧰}
- **Mark as Read:** Click the completion button to update your progress dashboard.
- **Notes & Reflection:** Use the private notes panel to document your understanding.
- **Simplify:** Feeling overwhelmed? Click **Simplify** to get a high-level summary of the current section.
:::`,
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

Validate your knowledge with multiple-choice assessments grounded in your codebase.

:::card[Immediate Feedback]{✅}
Answer questions and get instant results. Correct and incorrect answers both provide deep-dive explanations linked back to the sources.
:::

:::step[1. Complete Quiz]
Work through the 5-10 questions per module. Your score is tracked automatically on your member profile.
:::

:::step[2. Review Gaps]
After submission, RocketBoard highlights specific module sections you should revisit based on missed questions.
:::

:::card[Retake Policy]{🔄}
You can retake any quiz multiple times. Your **most recent score** is what will be reflected on your manager's dashboard.
:::`,
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
    lastUpdated: "2026-03-13",
    content: `# Using AI Chat

RocketBoard has two AI assistants, each grounded in your actual codebase and documentation.

## 🚀 Rocket (Module Chat)

:::card[Module-Specific Intelligence]{🧠}
Rocket is available on every module page (bottom-right FAB). It answers questions about the current module's content, grounded in evidence from your connected sources.
:::

:::step[1. Ask a Question]
Type any question about the module — e.g., "How does the auth flow work?" or "Explain this middleware."
:::

:::step[2. Read Citations]
The AI response includes inline citation badges like **[S1]**, **[S2]**, etc. These are interactive:
- **Hover** over a badge to see a preview of the source code snippet.
- **Click** the badge to open the full file in the Source Explorer with syntax highlighting.
:::

:::step[3. Explore Sources]
At the bottom of each response, you'll see interactive source badges showing the files referenced. Click any badge to dive into the evidence that grounded the AI's answer.
:::

:::step[4. Report Issues]
If an answer seems incorrect or misleading, click the **🚩 Report** button. Your feedback is tagged with a trace ID and routed to pack authors for review.
:::

## 🧭 Mission Control (Global Chat)

:::card[Platform Assistant]{🗺️}
Mission Control is available on all pages (bottom-left). It answers questions about RocketBoard's features, settings, and navigation.
:::

- Ask: "How do I bookmark something?" or "What keyboard shortcuts are available?"
- It can trigger UI actions — e.g., switching themes or navigating to specific pages.`,
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

Cohorts are groups of learners who started onboarding around the same time, helping them learn together.

:::card[Peer Progress]{📅}
See how your peers are doing (respecting privacy settings) to gauge your own ramp-up speed.
:::

:::card[Management]{🛠️}
Admins can create and manage cohorts to track specific hiring classes or project teams.
:::

:::card[Visibility]{👁️}
Cohort members can see each other's completion status, fostering a sense of shared progress and healthy competition.
:::`,
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

RocketBoard adapts to your specific learning style and technical background. Customize your experience in the **Settings** panel.

:::card[Audience Profile]{👤}
- **Technical:** Focuses on code implementation and architecture.
- **Non-Technical:** Prioritizes workflows, business logic, and concepts.
- **Mixed:** A balanced blend for cross-functional teams.
:::

:::card[Content Depth]{📚}
- **Shallow:** Quick, 5-minute overviews of key features.
- **Standard:** The default experience for most learners.
- **Deep:** Comprehensive guides covering edge cases and performance.
:::

:::card[Theme & Privacy]{🎨}
Toggle between **Light/Dark** modes or sync with your system. You can also control your **Peer Privacy** settings to hide or show your progress in cohorts.
:::`,
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

Authors can fine-tune exactly how much content the AI drafts during the generation cascade.

:::card[Word Limits]{🔡}
**Max Module Words:** Prevents the AI from drafting overly verbose sections. Default: 1,400 words.
:::

:::card[Educational Limits]{📝}
**Max Quiz Questions:** Controls how many multiple-choice questions are generated per module. Default: 5.
**Max Key Takeaways:** Limits the number of summary points at the end of each section. Default: 5.
:::`,
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

RocketBoard roles determine exactly what you can see and edit.

:::card[Elevated Access]{⚙️}
- **Owner:** Full organizational control, including billing and deletions.
- **Admin:** Broad management powers for members, settings, and all packs.
- **Author:** Strategic power to curate sources and trigger AI generation.
:::

:::card[Consumption Access]{📖}
- **Learner:** Standard access to read, quiz, and track ramp-up.
- **Read Only:** View-only access to published modules without interactive quizzes.
:::

[See the full Roles & Permissions table](/help/getting-started/understanding-roles)`,
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

:::card[System Timeout]{⏱️}
The repository is exceptionally large (>500MB). Try connecting specific subdirectories instead of the whole mono-repo.
:::

## Steps to Fix

:::step[1. Check Permissions]
Verify that the credentials or tokens used for the source are still valid and haven't expired.
:::

:::step[2. Connectivity Test]
Ensure the source URL is accessible from a standard browser window.
:::

:::step[3. Re-Add Source]
Sometimes a fresh start is best. Remove the source and attempt to add it again with a fresh token.
:::`,
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

Sometimes the AI Agent runs into a wall. Here’s how to handle common errors.

:::card[Insufficient Evidence]{📉}
**Cause:** The selected sources don't contain enough information to answer the prompt.
**Fix:** Add more relevant source files or broaden your source selection.
:::

:::card[Rate Limited]{⏳}
**Cause:** We've hit a temporary peak in AI service demand.
**Fix:** Wait about 30 seconds and click **Retry**.
:::

:::card[Credit Exhausted]{💳}
**Cause:** Your organization has reached its monthly AI token limit.
**Fix:** Contact your pack admin to upgrade your plan.
:::

:::card[Network Error]{🌐}
**Cause:** A glitch in the connection between your browser and our AI engines.
**Fix:** Check your internet connection and try again.
:::`,
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

If the AI-generated content seems inaccurate or stale, follow these steps to repair it.

:::step[1. Check Health]
Open the **Content Health** dashboard to see if the AI has already flagged stale citations for this module.
:::

:::step[2. Re-Sync Sources]
If code has changed recently, click **Sync** on the source card to update the underlying knowledge chunks.
:::

:::step[3. AI Refine]
Use the **Refine** button on the module to describe what's wrong. The AI will rewrite the section based on your feedback.
:::

:::card[Report Issue]{🚩}
Click the flag icon on any section to notify a Pack Author that the content needs manual review.
:::`,
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
    content: `# Quiz Quality & Fairness

We strive for 100% accuracy, but AI-generated questions can sometimes be ambiguous.

:::card[Report Inaccuracy]{🚩}
Use the **feedback** button immediately after answering a question to report a technical error or unfair framing.
:::

:::step[1. Author Review]
Pack authors are notified of flagged questions. They can edit the text manually or click **Regenerate** to try a different angle.
:::

:::step[2. Global Analytics]
Admins can view correct/incorrect rates for every question. Any question with an abnormally low success rate is automatically highlighted for review.
:::`,
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
    lastUpdated: "2026-03-13",
    content: `# What's New in RocketBoard

## March 2026 (Latest)
- **Interactive Chat Citations** — Click \`[S1]\`, \`[S2]\` badges in AI responses to open source code with syntax highlighting. Hover for instant previews.
- **AI Observability** — Full telemetry tracing for all AI tasks (token usage, latency, cost). Trace IDs link user feedback to specific AI interactions.
- **Automated Remediation** — AI-drafted module updates when source code changes are detected via GitHub webhooks
- **Content Health Dashboard** — Track when source code changes affect generated content
- **Guided Tours** — Interactive walkthroughs for first-time users on every major page
- **Help Center** — Searchable in-app help with articles for every feature
- **Platform-Aware Mission Control** — Ask about RocketBoard features and get accurate answers
- **Help Tooltips** — Contextual ⓘ tooltips across the entire platform

## February 2026
- **Exercises** — Hands-on coding challenges with AI review
- **Spaced Repetition** — Review schedule for long-term retention
- **Cohorts** — Peer group progress tracking
- **Bookmarks & Collections** — Save and organize content`,
    relatedArticles: [],
  },
];
