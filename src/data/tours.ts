import type { Tour } from "@/lib/tour-system";

export const ALL_TOURS: Tour[] = [
  {
    id: "dashboard-welcome",
    pagePattern: "^/packs/[^/]+$",
    steps: [
      {
        target: "[data-tour='dashboard-hero']",
        title: "Welcome to Your Pack Dashboard!",
        content: "This is your home base. You'll see your progress, modules, and quick actions here. Let's take a quick look around.",
      },
      {
        target: "[data-tour='continue-learning']",
        title: "Continue Where You Left Off",
        content: "This button always takes you to your most recent module and section. It's the fastest way to resume learning.",
      },
      {
        target: "[data-tour='stats-strip']",
        title: "Your Progress at a Glance",
        content: "Track your modules completed, sections read, and quiz scores. These update in real-time as you learn.",
      },
      {
        target: "[data-tour='module-grid']",
        title: "Your Learning Modules",
        content: "Each card represents a module. Click to start reading. Modules may have prerequisites — locked ones show a 🔒 icon.",
      },
      {
        target: "[data-tour='suggested-action']",
        title: "Smart Suggestions",
        content: "RocketBoard suggests your next step based on your progress. Follow these for the most effective onboarding path.",
      },
      {
        target: "[data-tour='sidebar-nav']",
        title: "Navigation",
        content: "Use the sidebar to access all features: Modules, Glossary, Paths, Team Directory, Discussions, and more. Press **Cmd+K** to search anything.",
      },
    ],
  },
  {
    id: "sources-setup",
    pagePattern: "^/packs/[^/]+/sources$",
    requiredRole: "author",
    steps: [
      {
        target: "[data-tour='sources-heading']",
        title: "Connect Your Knowledge Sources",
        content: "This is where you connect your codebase and documents. RocketBoard analyzes these to generate onboarding content.",
      },
      {
        target: "[data-tour='add-source']",
        title: "Add a Source",
        content: "Start by adding a GitHub repository or uploading documents. You can add multiple sources — most packs have 2-5 sources.",
      },
      {
        target: "[data-tour='source-list']",
        title: "Source Management",
        content: "After adding a source, click 'Sync' to ingest the content. You'll see the chunk count and can browse individual chunks.",
      },
    ],
  },
  {
    id: "plan-curation",
    pagePattern: "^/packs/[^/]+/plan$",
    requiredRole: "author",
    steps: [
      {
        target: "[data-tour='generate-plan']",
        title: "Generate Your Learning Plan",
        content: "Click here and the AI will analyze your sources to propose onboarding modules tailored to your codebase.",
      },
      {
        target: "[data-tour='detected-signals']",
        title: "What the AI Found",
        content: "These 'signals' show technologies and patterns detected in your code. They explain why specific modules were proposed.",
      },
      {
        target: "[data-tour='module-plan-list']",
        title: "Your Module Plan",
        content: "These are the proposed modules. You have full editorial control: edit titles, reorder by dragging, add custom modules, or remove ones you don't need.",
      },
      {
        target: "[data-tour='module-card-edit']",
        title: "Edit Modules In-Place",
        content: "Click any title or description to edit. Change difficulty, time estimates, and assign tracks or templates per module.",
      },
      {
        target: "[data-tour='prerequisites']",
        title: "Set Prerequisites",
        content: "Define which modules must be completed before others. 'Hard' prerequisites lock the module; 'Soft' ones just show a recommendation.",
      },
      {
        target: "[data-tour='approve-plan']",
        title: "Approve When Ready",
        content: "Once you're happy with the plan, approve it. This enables content generation. You can always regenerate a new plan later.",
      },
    ],
  },
  {
    id: "review-publish",
    pagePattern: "^/packs/[^/]+/review$",
    requiredRole: "author",
    steps: [
      {
        target: "[data-tour='review-heading']",
        title: "Review Your Generated Content",
        content: "All modules and supporting content are generated as drafts. Review everything here before making it visible to learners.",
      },
      {
        target: "[data-tour='review-module-card']",
        title: "Module Review Card",
        content: "Preview each module, refine it with AI assistance, or regenerate from scratch. Check for warnings and contradictions.",
      },
      {
        target: "[data-tour='preview-button']",
        title: "Preview as Learner",
        content: "See exactly what learners will see. Check that code snippets are relevant, explanations are clear, and citations are accurate.",
      },
      {
        target: "[data-tour='refine-button']",
        title: "Refine with AI",
        content: "Tell the AI what to change in plain English: 'Add more detail about error handling' or 'Simplify section 3'. The AI updates the module and shows you what changed.",
      },
      {
        target: "[data-tour='publish-button']",
        title: "Publish to Learners",
        content: "When you're satisfied, publish the pack. All draft content becomes visible to learners immediately. You can continue editing after.",
      },
    ],
  },
  {
    id: "module-reading",
    pagePattern: "^/packs/[^/]+/modules/[^/]+$",
    steps: [
      {
        target: "[data-tour='module-header']",
        title: "Welcome to This Module",
        content: "You'll read through sections at your own pace. Mark each section as read when you're done with it.",
      },
      {
        target: "[data-tour='module-tabs']",
        title: "Four Tabs",
        content: "**Content:** the learning material. **Quiz:** test your knowledge. **Exercises:** hands-on challenges. **Discussions:** ask questions and share tips.",
      },
      {
        target: "[data-tour='module-section']",
        title: "Reading Sections",
        content: "Expand each section to read. Look for code snippets from your actual codebase — they're highlighted with file paths.",
      },
      {
        target: "[data-tour='mark-read']",
        title: "Track Your Progress",
        content: "Click to mark a section as completed. Your progress is saved automatically and you can resume anytime.",
      },
      {
        target: "[data-tour='notes-button']",
        title: "Take Personal Notes",
        content: "Click to open a notes panel for this section. Your notes are private and saved automatically. Use the suggested prompts for guided reflection.",
      },
      {
        target: "[data-tour='citation-badge']",
        title: "Source References",
        content: "These badges link to the actual source code. Click to view the original file with syntax highlighting. Hover for a preview.",
      },
      {
        target: "[data-tour='bookmark-button']",
        title: "Save for Later",
        content: "Bookmark any section for quick reference. Access all saved items from the 🔖 Saved page in the sidebar.",
      },
      {
        target: "[data-tour='rocket-fab']",
        title: "Ask the AI",
        content: "Click to open Rocket — your module-specific AI assistant. Ask questions about anything in this module and get answers grounded in your actual codebase.",
      },
    ],
  },
  {
    id: "glossary-intro",
    pagePattern: "^/packs/[^/]+/glossary$",
    steps: [
      {
        target: "[data-tour='glossary-search']",
        title: "Search Glossary Terms",
        content: "Type to instantly filter terms. Search matches term names and definitions.",
      },
      {
        target: "[data-tour='glossary-track-filter']",
        title: "Filter by Track",
        content: "Show only terms relevant to your role track (e.g., Frontend, Backend).",
      },
      {
        target: "[data-tour='glossary-term']",
        title: "Term Details",
        content: "Each term includes a definition, usage context (often with code examples), and links to the source evidence.",
      },
    ],
  },
  {
    id: "paths-intro",
    pagePattern: "^/packs/[^/]+/paths$",
    steps: [
      {
        target: "[data-tour='paths-tabs']",
        title: "Day 1 and Week 1",
        content: "Start with Day 1 for immediate setup tasks. Week 1 covers deeper exploration over your first full week.",
      },
      {
        target: "[data-tour='paths-step']",
        title: "Step-by-Step Guidance",
        content: "Each step has a description, sub-steps, time estimate, and success criteria. Check off steps as you complete them.",
      },
      {
        target: "[data-tour='paths-tabs']",
        title: "Track Your Path Progress",
        content: "Progress is saved automatically. Come back anytime to continue where you left off.",
      },
    ],
  },
  {
    id: "team-intro",
    pagePattern: "^/packs/[^/]+/team$",
    steps: [
      {
        target: "[data-tour='team-member']",
        title: "Meet Your Team",
        content: "Each card shows a team member, their areas of expertise, and what they own in the codebase.",
      },
      {
        target: "[data-tour='meeting-checkbox']",
        title: "Track Your 1:1 Meetings",
        content: "Check off each person as you meet with them. Suggested topics help you have productive conversations.",
      },
      {
        target: "[data-tour='meeting-progress']",
        title: "Meeting Progress",
        content: "Aim to meet all recommended people during your first two weeks. These connections are invaluable for ramping up.",
      },
    ],
  },
];
