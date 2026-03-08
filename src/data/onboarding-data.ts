export type Track = "frontend" | "backend" | "infra" | "cross-repo";

export interface Section {
  id: string;
  title: string;
  content: string;
  tracks: Track[];
  notes?: string;
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface Module {
  id: string;
  title: string;
  description: string;
  icon: string;
  sections: Section[];
  quiz: QuizQuestion[];
  estimatedMinutes: number;
}

export const TRACKS: { key: Track; label: string; color: string }[] = [
  { key: "frontend", label: "Frontend", color: "track-frontend" },
  { key: "backend", label: "Backend", color: "track-backend" },
  { key: "infra", label: "Infra", color: "track-infra" },
  { key: "cross-repo", label: "Cross-repo", color: "track-cross" },
];

export const modules: Module[] = [
  {
    id: "mod-1",
    title: "Architecture Overview",
    description: "Understand the high-level system architecture, service boundaries, and how data flows across the platform.",
    icon: "🏗️",
    estimatedMinutes: 15,
    sections: [
      {
        id: "s1-1",
        title: "System Topology",
        content: "Our platform follows a microservices architecture with event-driven communication. The core services include the API Gateway, Auth Service, User Service, Content Engine, and Analytics Pipeline. Each service owns its data store and communicates via async message queues with synchronous REST fallbacks for critical paths.",
        tracks: ["frontend", "backend", "infra"],
      },
      {
        id: "s1-2",
        title: "Frontend Architecture",
        content: "The frontend is a React SPA using Vite for bundling. State management uses TanStack Query for server state and Zustand for client state. The component library is built on top of Radix UI primitives with a custom design system. Code splitting is route-based with lazy loading for heavy modules.",
        tracks: ["frontend"],
        notes: "Check the design-system package in the monorepo for component docs.",
      },
      {
        id: "s1-3",
        title: "Backend Services",
        content: "Backend services are written in TypeScript (Node.js) and Go. The API Gateway handles routing, rate limiting, and auth token validation. Individual services expose gRPC interfaces internally and REST externally. Database choices vary: PostgreSQL for relational data, Redis for caching, and ClickHouse for analytics.",
        tracks: ["backend"],
        notes: "See the service-catalog repo for the full list of services and their owners.",
      },
      {
        id: "s1-4",
        title: "Infrastructure Layer",
        content: "Infrastructure is managed via Terraform with Kubernetes (EKS) as the orchestration layer. CI/CD runs on GitHub Actions with ArgoCD for GitOps deployments. Monitoring uses Grafana + Prometheus + Loki stack. All secrets are managed through Vault with auto-rotation policies.",
        tracks: ["infra"],
      },
    ],
    quiz: [
      {
        id: "q1-1",
        question: "What communication pattern do the core services primarily use?",
        options: ["Synchronous REST only", "Event-driven with async message queues", "GraphQL subscriptions", "Direct database sharing"],
        correctIndex: 1,
        explanation: "Services communicate via async message queues with synchronous REST fallbacks for critical paths.",
      },
      {
        id: "q1-2",
        question: "Which database is used for analytics data?",
        options: ["PostgreSQL", "MongoDB", "ClickHouse", "Redis"],
        correctIndex: 2,
        explanation: "ClickHouse is used for analytics due to its columnar storage optimized for OLAP queries.",
      },
    ],
  },
  {
    id: "mod-2",
    title: "Development Workflow",
    description: "Learn the end-to-end development workflow from branching strategy to production deployment.",
    icon: "🔄",
    estimatedMinutes: 12,
    sections: [
      {
        id: "s2-1",
        title: "Branching Strategy",
        content: "We use trunk-based development with short-lived feature branches. Branch naming follows the pattern: type/TICKET-description (e.g., feat/RB-123-add-sidebar). All branches must be rebased onto main before merging. Squash merges are enforced.",
        tracks: ["frontend", "backend", "infra", "cross-repo"],
      },
      {
        id: "s2-2",
        title: "Code Review Process",
        content: "PRs require at least 2 approvals from team members. The CODEOWNERS file auto-assigns reviewers. CI must pass before merge. Reviews should focus on: correctness, performance implications, test coverage, and adherence to our style guide. Use conventional comments (suggestion:, issue:, praise:).",
        tracks: ["frontend", "backend", "infra", "cross-repo"],
        notes: "Check .github/CODEOWNERS for the current ownership map.",
      },
      {
        id: "s2-3",
        title: "CI/CD Pipeline",
        content: "The pipeline runs: lint → type-check → unit tests → integration tests → build → deploy preview. Deploys to staging are automatic on merge to main. Production deploys require a manual approval gate via ArgoCD. Rollbacks are automated if health checks fail within 5 minutes.",
        tracks: ["infra", "cross-repo"],
      },
      {
        id: "s2-4",
        title: "Local Development Setup",
        content: "Use the dev-env CLI to bootstrap your local environment. It sets up Docker containers for all dependencies, seeds the database, and configures hot reload. Frontend devs can run `pnpm dev` for Vite dev server with HMR. Backend devs use `make dev` which spins up the service with file watching.",
        tracks: ["frontend", "backend"],
        notes: "Run `dev-env doctor` if you encounter setup issues.",
      },
    ],
    quiz: [
      {
        id: "q2-1",
        question: "What branching strategy does the team use?",
        options: ["Gitflow", "Trunk-based development", "Feature branching with long-lived branches", "Forking workflow"],
        correctIndex: 1,
        explanation: "We use trunk-based development with short-lived feature branches for rapid integration.",
      },
      {
        id: "q2-2",
        question: "How many PR approvals are required before merging?",
        options: ["1", "2", "3", "None - just CI passing"],
        correctIndex: 1,
        explanation: "PRs require at least 2 approvals from team members before they can be merged.",
      },
    ],
  },
  {
    id: "mod-3",
    title: "Monitoring & Incidents",
    description: "Learn how we monitor systems, respond to incidents, and conduct post-mortems.",
    icon: "🚨",
    estimatedMinutes: 10,
    sections: [
      {
        id: "s3-1",
        title: "Observability Stack",
        content: "Our observability is built on three pillars: Metrics (Prometheus + Grafana), Logs (Loki + Grafana), and Traces (OpenTelemetry + Tempo). Every service emits structured JSON logs and exports OTLP traces. Dashboards are version-controlled in the monitoring repo.",
        tracks: ["infra", "backend"],
      },
      {
        id: "s3-2",
        title: "Alerting & On-Call",
        content: "Alerts are defined as code in Prometheus rules and routed through Alertmanager to PagerDuty. On-call rotations are weekly. The primary responder has 5 minutes to acknowledge. Escalation goes: primary → secondary → engineering manager → VP Eng. All incidents get a Slack channel auto-created.",
        tracks: ["infra"],
        notes: "Check #incident-response Slack channel for active incidents.",
      },
      {
        id: "s3-3",
        title: "Post-Mortem Culture",
        content: "Every P0/P1 incident requires a blameless post-mortem within 48 hours. The template covers: timeline, impact, root cause, contributing factors, and action items. Action items must be ticketed and assigned. We review post-mortems in the monthly engineering all-hands.",
        tracks: ["frontend", "backend", "infra", "cross-repo"],
      },
    ],
    quiz: [
      {
        id: "q3-1",
        question: "What is the acknowledgment SLA for the primary on-call responder?",
        options: ["1 minute", "5 minutes", "15 minutes", "30 minutes"],
        correctIndex: 1,
        explanation: "The primary responder has 5 minutes to acknowledge an alert before it escalates.",
      },
    ],
  },
];
