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
  {
    id: "mod-4",
    title: "Security & Access Control",
    description: "Understand authentication patterns, authorization models, and security best practices across the stack.",
    icon: "🔐",
    estimatedMinutes: 14,
    sections: [
      {
        id: "s4-1",
        title: "Authentication Flow",
        content: "Authentication uses OAuth 2.0 with PKCE for SPAs and JWTs for service-to-service communication. Access tokens expire after 15 minutes with refresh tokens valid for 7 days. The Auth Service issues tokens and validates them at the API Gateway layer before requests reach downstream services.",
        tracks: ["frontend", "backend"],
      },
      {
        id: "s4-2",
        title: "Authorization Model",
        content: "We use RBAC (Role-Based Access Control) with a permission hierarchy: Owner → Admin → Editor → Viewer. Permissions are stored in PostgreSQL and cached in Redis with a 5-minute TTL. The authorization middleware checks permissions on every API request. Fine-grained permissions use a resource:action format (e.g., project:delete).",
        tracks: ["backend"],
        notes: "See the auth-policies repo for the full permission matrix.",
      },
      {
        id: "s4-3",
        title: "Secret Management",
        content: "All secrets are stored in HashiCorp Vault with automatic rotation. Application secrets are injected as environment variables via the Vault Agent sidecar in Kubernetes. Database credentials rotate every 24 hours. API keys for third-party services use scoped tokens with minimum required permissions.",
        tracks: ["infra", "backend"],
      },
      {
        id: "s4-4",
        title: "Frontend Security",
        content: "The frontend implements Content Security Policy (CSP) headers, CSRF protection via SameSite cookies, and input sanitization using DOMPurify. All API calls use HTTPS with certificate pinning in mobile clients. Sensitive data is never stored in localStorage — we use httpOnly cookies for auth tokens.",
        tracks: ["frontend"],
        notes: "Run `pnpm audit` regularly to check for dependency vulnerabilities.",
      },
    ],
    quiz: [
      {
        id: "q4-1",
        question: "How long are access tokens valid before they expire?",
        options: ["5 minutes", "15 minutes", "1 hour", "24 hours"],
        correctIndex: 1,
        explanation: "Access tokens expire after 15 minutes to minimize the window of compromise if a token is leaked.",
      },
      {
        id: "q4-2",
        question: "What authorization model does the platform use?",
        options: ["ACL (Access Control Lists)", "RBAC (Role-Based Access Control)", "ABAC (Attribute-Based Access Control)", "No formal model"],
        correctIndex: 1,
        explanation: "We use RBAC with a permission hierarchy: Owner → Admin → Editor → Viewer.",
      },
    ],
  },
  {
    id: "mod-5",
    title: "Testing Strategy",
    description: "Learn the testing pyramid, coverage expectations, and how to write effective tests at every level.",
    icon: "🧪",
    estimatedMinutes: 11,
    sections: [
      {
        id: "s5-1",
        title: "Testing Pyramid",
        content: "We follow a testing pyramid: many unit tests (fast, isolated), fewer integration tests (service boundaries), and minimal E2E tests (critical user flows). Target coverage: 80% for unit, 60% for integration. E2E tests cover the top 10 user journeys. Tests run in CI on every PR.",
        tracks: ["frontend", "backend", "cross-repo"],
      },
      {
        id: "s5-2",
        title: "Frontend Testing",
        content: "Frontend tests use Vitest for unit tests and React Testing Library for component tests. We test behavior, not implementation — query by role and text, not by CSS class or test ID. Storybook is used for visual regression testing with Chromatic. Accessibility tests run via axe-core in every component test.",
        tracks: ["frontend"],
        notes: "Use `pnpm test:watch` for TDD workflow with hot-reloading tests.",
      },
      {
        id: "s5-3",
        title: "Backend Testing",
        content: "Backend services use Go's built-in testing for unit tests and Testcontainers for integration tests that need real databases. API contract tests use Pact to ensure service compatibility. Load testing runs weekly with k6, targeting p99 latency under 200ms for critical endpoints.",
        tracks: ["backend"],
      },
      {
        id: "s5-4",
        title: "E2E & Smoke Tests",
        content: "End-to-end tests use Playwright running against a staging environment. Critical flows tested: signup → onboarding → first action → billing. Smoke tests run post-deploy and block promotion to production if any fail. Test data is seeded fresh for each run using factory functions.",
        tracks: ["frontend", "backend", "cross-repo"],
        notes: "E2E tests live in the e2e-tests repo. Ask #qa channel for access.",
      },
    ],
    quiz: [
      {
        id: "q5-1",
        question: "What is the unit test coverage target?",
        options: ["50%", "60%", "80%", "100%"],
        correctIndex: 2,
        explanation: "The target is 80% unit test coverage to balance thoroughness with development velocity.",
      },
      {
        id: "q5-2",
        question: "Which tool is used for E2E testing?",
        options: ["Cypress", "Playwright", "Selenium", "Puppeteer"],
        correctIndex: 1,
        explanation: "Playwright is used for E2E tests due to its cross-browser support and reliable auto-waiting.",
      },
    ],
  },
];
