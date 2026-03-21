---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
status: 'complete'
completedAt: '2026-02-22'
inputDocuments:
  - '_bmad-output/planning-artifacts/prd.md'
  - '_bmad-output/project-context.md'
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture.md'
  - 'docs/data-models.md'
  - 'docs/api-contracts.md'
  - 'docs/integration-architecture.md'
  - 'docs/development-guide.md'
  - 'docs/source-tree-analysis.md'
  - 'docs/domain-research-strength-training.md'
workflowType: 'architecture'
project_name: 'Strenly'
user_name: 'Tomi'
date: '2026-02-21'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**
56 FRs across 10 domains. The project is brownfield with core infrastructure (auth, exercise library, program grid editor, athlete CRUD, subscription model foundation) already implemented. Remaining MVP scope spans 4 phases: RBAC audit + settings (Phase 1), coach web completion (Phase 2), athlete PWA from scratch (Phase 3), and payment integration (Phase 4).

The Program aggregate (FR1-FR15) is the most architecturally complex feature — a deeply nested hierarchy (Program → Week → Session → ExerciseGroup → GroupItem → Series) with JSONB prescriptions per exercise per week. The grid editor implementing this is near-complete.

Workout logging (FR25-FR31) bridges both apps — coaches log on behalf of athletes (coach web) and athletes log directly (PWA). The logging data model exists but the UX flows are incomplete.

The Athlete PWA (FR45-FR49) is entirely greenfield — no app shell, no auth flow, no UI exists yet.

**Non-Functional Requirements:**
- Performance: Grid keyboard nav < 50ms, program aggregate load < 1s, PWA initial load < 3s on 4G, workout logging interactions < 200ms
- Security: HTTPS everywhere, HttpOnly+Secure session cookies, multi-tenant data isolation with zero cross-org leaks
- Reliability: Explicit save persists all program data, workout logs persist immediately, graceful error handling (error UI, not blank screens)

**Scale & Complexity:**
- Primary domain: Full-stack SaaS (Hono API + React SPA + React PWA + Neon PostgreSQL)
- Complexity level: Medium-High
- Estimated architectural components: 6 packages (core, database, auth, backend, contracts) + 2 apps (coach-web, athlete-pwa) + shared UI components

### Technical Constraints & Dependencies

| Constraint | Impact |
|-----------|--------|
| Solo developer (AI-assisted) | Architecture must minimize coordination overhead; phased delivery essential |
| Brownfield — existing Clean Architecture | New features MUST follow established patterns (Entity → Port → Repo → Use Case → Contract → Procedure) |
| Better-Auth for auth + organizations | RBAC evolution constrained by Better-Auth's organization plugin capabilities |
| oRPC for API transport | All endpoints POST via RPCLink; no REST conventions |
| Neon PostgreSQL (serverless) | Connection pooling built-in; cold start considerations for PWA |
| No email service for MVP | Athlete/coach invitations are link-based only |
| One organization per athlete (MVP) | Multi-gym deferred; simplifies data model |
| Payment provider undecided | Phase 4 blocked until MercadoPago or alternative is chosen |
| Base UI only (zero Radix) | UI primitives must use @base-ui/react, not Radix |

### Cross-Cutting Concerns Identified

1. **Multi-tenancy** — Every tenant-scoped query filters by `organizationId`. Application-level filtering is primary; RLS policies are safety net. Affects every repository, use case, and procedure.

2. **RBAC evolution** — Current 3-role model (Owner/Admin/Member) must split into Coach/Athlete with hierarchical or multi-role strategy. Affects authorization checks in every use case.

3. **Error handling pipeline** — Domain returns `Result`, use cases return `ResultAsync`, procedures throw oRPC errors, frontend handles via `handleMutationError`. Each layer has its own error type taxonomy.

4. **Shared contracts** — Zod schemas in `@strenly/contracts` are the single source of truth for both frontend and backend. Any API change requires contract update first.

5. **Session caching** — Better-Auth sessions cached with 5-min TTL to avoid repeated API calls during navigation. Both apps (coach-web, PWA) need this strategy.

6. **Offline/PWA considerations** — Athlete PWA needs service worker strategy for workout logging resilience. Coach web does not require offline support.

7. **Optimistic UI** — Program grid editor uses Zustand store for pending changes with explicit save. Workout logging needs similar optimistic update strategy.

## Starter Template Evaluation

### Primary Technology Domain

Full-stack SaaS monorepo — brownfield project with established architecture. No starter template needed for the main project.

### Existing Technology Stack (Confirmed)

| Layer | Technology | Version | Status |
|-------|-----------|---------|--------|
| Monorepo | pnpm workspaces + Turbo | 9.15.4 / 2.5.4 | Production |
| Language | TypeScript (strict, ESM) | 5.7.3 | Production |
| Linting/Format | Biome | 2.3.12 | Production |
| Frontend | React + Vite + TanStack Router/Query | 19 | Production |
| UI Primitives | Base UI + shadcn/ui + Tailwind CSS | @base-ui/react 1.0.0 | Production |
| Complex State | Zustand | — | Production |
| API Framework | Hono + oRPC (RPCLink) | — | Production |
| Database | Neon PostgreSQL + Drizzle ORM | — | Production |
| Auth | Better-Auth (organization plugin) | — | Production |
| Validation | Zod 4 | — | Production |
| Error Handling | neverthrow (ResultAsync) | — | Production |
| Unit Testing | Vitest | — | Production |
| E2E Testing | Playwright | — | Production |
| Deployment | Railway (API) + Vercel (coach-web) | — | Production |

### Greenfield Component: Athlete PWA

The only new app to scaffold is `apps/athlete-pwa`. It will follow the same pattern as `apps/coach-web` (React + Vite) with additional PWA configuration:

- Vite PWA plugin (`vite-plugin-pwa`) for service worker generation
- Web app manifest (name, icons, theme color, display: standalone)
- Same oRPC client setup with `@strenly/backend` RouterClient type
- Same `@strenly/contracts` for shared schemas
- TanStack Router (file-based) + TanStack Query
- Mobile-first Tailwind CSS + Base UI + shadcn/ui
- Deployment target: Vercel (separate domain: athlete.strenly.com.ar)

**Note:** Detailed PWA architecture decisions (offline strategy, caching, auth flow) are deferred to Step 4 architectural decisions.

### Architectural Decisions Already Established by Stack

All foundational technology decisions are locked and production-tested. The architecture document focuses on decisions for **remaining MVP features** (RBAC evolution, PWA architecture, payment integration, dashboard data strategy) rather than technology selection.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. RBAC multi-role model with OrganizationRole naming
2. Athlete PWA auth flow via /invite/{token}
3. Workout logging persistence strategy (online-only)

**Important Decisions (Shape Architecture):**
4. Dashboard hybrid data strategy
5. Payment gateway adapter pattern
6. Athlete PWA UI isolation (no shared packages/ui)

**Deferred Decisions (Post-MVP):**
- Offline/localStorage workout caching (evolve if gym signal is a real problem)
- PWA push notifications architecture
- AI copilot integration architecture

### Data Architecture

**Already established:** Neon PostgreSQL + Drizzle ORM, JSONB prescriptions, Program aggregate hierarchy.

**Dashboard data:** Hybrid strategy — `dashboard/summary` endpoint returns lightweight aggregate stats via `Promise.all` count queries. Drill-down endpoints for detail views, reusing existing list endpoints where possible.

### Authentication & Security

**RBAC Evolution — Multi-Role:**
- Storage: Better-Auth `members.role` text field with comma-separated values (e.g., `"owner,coach"`)
- Domain type: `OrganizationRole` defined in `packages/core` (type + valid roles list)
- Parsing: `packages/backend/src/lib/roles.ts` — `parseRoles()` converts DB string to `OrganizationRole[]` via Zod
- Context: `context.ts` calls `parseRoles()` — transparent to the rest of the application
- Authorization: `hasPermission(roles: OrganizationRole[], permission)` returns true if ANY role has the permission
- Naming: `OrganizationRole` everywhere (not `Role` or `MemberRole`)
- Roles: `owner | manager | coach | athlete`

**Impact areas:**
- `packages/core/src/services/authorization.ts` — defines OrganizationRole type, accepts OrganizationRole[]
- `packages/backend/src/lib/roles.ts` — NEW: parseRoles() with Zod validation
- `packages/backend/src/lib/context.ts` — calls parseRoles() to build AuthContext
- `packages/contracts/src/common/roles.ts` — REMOVE role parsing (move to backend)
- All use cases — already call hasPermission, signature change propagates

**Athlete PWA Auth Flow:**
- `/invite/{token}` is the ONLY entry point for athletes — no public `/signup`
- Unauthenticated user: shows invitation/org info → signup form (same screen)
- Authenticated user: shows invitation info → "Accept" button → auto-link
- Post-acceptance: redirect to PWA home
- Reuses existing `getInvitationInfo` (public) + `acceptInvitation` (authenticated)

### API & Communication Patterns

**Already established:** oRPC over HTTP (POST), RPCLink, X-Organization-Slug header, error handling pipeline.

**Dashboard API:**
- `dashboard/summary` — single aggregate endpoint returning stats object
- Drill-down via existing list endpoints with filters (e.g., `athletes/list?status=inactive`)
- Summary query uses `Promise.all` for parallel count queries

### Frontend Architecture

**Athlete PWA UI Strategy:**
- Independent copy of base UI components (button, input, dialog, field, etc.)
- No shared `packages/ui` — each app evolves independently
- Mobile-first Tailwind CSS + Base UI + shadcn/ui
- Rationale: coach-web (keyboard-first desktop) and athlete-pwa (touch-first mobile) have radically different UX. Previous attempt at shared UI package caused problems.

**Workout Logging (PWA):**
- Online-only persistence — every save goes directly to the API
- No local cache, no localStorage backup
- Error UI shown on connection loss
- Can evolve to Zustand + localStorage if gym connectivity proves problematic

### Infrastructure & Deployment

**Already established:** Railway (API) + Vercel (coach-web).

**Athlete PWA:** Vercel deployment at `athlete.strenly.com.ar` (separate domain from coach-web).

**Payment Integration:**
- Adapter pattern: `PaymentGatewayPort` in `packages/core/src/ports/`
- Interface: `createCheckout()`, `handleWebhook(payload)`, `getPaymentStatus(id)`
- One adapter per provider in `packages/backend/src/infrastructure/services/`
- Webhooks normalized to domain events (payment_confirmed, payment_failed, subscription_cancelled)
- Use cases are provider-agnostic — only interact with the port
- Provider selection configurable — port can route to the correct adapter

### Decision Impact Analysis

**Implementation Sequence:**
1. RBAC refactor (OrganizationRole) — touches core, contracts, backend. Must be first.
2. Dashboard summary endpoint — new use case + procedure, no schema changes.
3. Athlete PWA scaffold — new app, copies UI components, sets up oRPC client.
4. PWA invite flow — builds on existing invitation backend.
5. PWA workout logging — online-only, reuses existing backend endpoints.
6. Payment adapter — Phase 4, after PWA is complete.

**Cross-Component Dependencies:**
- RBAC refactor must complete before Athlete PWA can implement role-based views
- Dashboard requires workout log data to show session completion stats
- Payment adapter depends on provider decision (external blocker)

## Implementation Patterns & Consistency Rules

### New Patterns (Supplement to project-context.md)

The existing `project-context.md` covers 67 rules for AI agents (naming, structure, error handling, testing, etc.). The patterns below cover ONLY what's new from the architectural decisions above.

### OrganizationRole Multi-Role Pattern

**Domain definition — `packages/core`:**
- `OrganizationRole` type defined in core: `owner | manager | coach | athlete`
- Core defines the list of valid roles and what permissions each has
- Core has zero external dependencies — no Zod, no parsing logic

**Parsing — `packages/backend/src/lib/roles.ts`:**
- Export a `parseRoles(roleString: string): OrganizationRole[]` function that:
  - Splits by comma, trims whitespace
  - Validates each segment with Zod against core's role definitions
  - Discards invalid values silently (no throw)
  - Returns typed `OrganizationRole[]`
- This is the ONLY place role parsing happens — single source of truth for DB → domain conversion
- `context.ts` calls `parseRoles()` — never parses manually, never uses `as` casting
- The domain doesn't care how roles are stored — it only knows what roles exist

**Permission model — no inheritance between roles:**
- Each role has its own discrete permission set — no role inherits from another
- `owner` is the only exception: has ALL permissions (superset)
- `manager` manages org operations but does NOT have coach permissions
- `coach` programs and works with athletes but does NOT manage org
- `athlete` only accesses own data and logs workouts
- Combined capabilities require combined roles (e.g., `"manager,coach"`)

**Permission matrix:**

| Permission | owner | manager | coach | athlete |
|-----------|-------|---------|-------|---------|
| organization:read | yes | yes | — | — |
| organization:manage | yes | yes | — | — |
| organization:delete | yes | — | — | — |
| members:read | yes | yes | yes | — |
| members:invite | yes | yes | — | — |
| members:remove | yes | yes | — | — |
| members:update-role | yes | — | — | — |
| billing:read | yes | yes | — | — |
| billing:manage | yes | — | — | — |
| athletes:read | yes | yes | yes | — |
| athletes:write | yes | — | yes | — |
| athletes:delete | yes | — | yes | — |
| programs:read | yes | — | yes | yes (own) |
| programs:write | yes | — | yes | — |
| programs:delete | yes | — | yes | — |
| exercises:read | yes | — | yes | — |
| exercises:write | yes | — | yes | — |
| workout_log:create | yes | — | yes | yes (own) |
| workout_log:read | yes | — | yes | yes (own) |
| workout_log:update | yes | — | yes | yes (own) |
| workout_log:delete | yes | — | yes | — |

**Authorization check:**
```typescript
hasPermission(roles: OrganizationRole[], permission: Permission): boolean
// Returns true if ANY role in the array has the permission
```

### Dashboard Endpoint Pattern

```typescript
// Summary endpoint returns flat stats object
type DashboardSummary = {
  activeAthletes: number
  totalAthletes: number
  programsByStatus: { draft: number; active: number; archived: number }
  sessionsCompletedThisWeek: number
  recentActivity: Array<{ type: string; athleteId: string; timestamp: string }>
}

// Use case: always parallel count queries via Promise.all
// Drill-down: reuse existing list endpoints with filters
```

### PWA Invite Flow Pattern

```
Route: /invite/{token} — single route handles both auth states

1. Validate token via getInvitationInfo (public, no auth)
   → Invalid/expired: error state, no forms shown
   → Valid: proceed based on session state

2a. No session → InviteSignupView
    - Show org name/info from invitation
    - Signup form (email + password)
    - On signup success → auto-accept invitation → redirect to PWA home

2b. Has session → InviteAcceptView
    - Show org name/info from invitation
    - "Accept" button
    - On accept → redirect to PWA home
```

### Payment Adapter Pattern

```typescript
// Port in packages/core/src/ports/
interface PaymentGatewayPort {
  createCheckout(input: CheckoutInput): ResultAsync<CheckoutResult, PaymentError>
  handleWebhook(payload: unknown): ResultAsync<PaymentEvent, PaymentError>
  getPaymentStatus(paymentId: string): ResultAsync<PaymentStatus, PaymentError>
}

// Normalized domain events — use cases only see these
type PaymentEvent =
  | { type: 'payment_confirmed'; subscriptionId: string; externalId: string }
  | { type: 'payment_failed'; subscriptionId: string; reason: string }
  | { type: 'subscription_cancelled'; subscriptionId: string }

// Factory selects adapter based on config
createPaymentGateway(provider: 'mercadopago' | 'stripe', config): PaymentGatewayPort
```

### Athlete PWA Conventions

| Pattern | Convention |
|---------|-----------|
| Touch targets | Minimum 44x44px, generous spacing |
| Navigation | Bottom tab bar (no sidebar), max 4 tabs |
| Loading states | Skeleton screens for content, not spinners |
| Error states | Retry button always visible, friendly message |
| Workout logging | Each save is an immediate POST, no batching |
| Signup | Only via `/invite/{token}` — no public signup route |

### Anti-Patterns for New Features

| Anti-pattern | Why to avoid |
|-------------|-------------|
| Check `role === 'coach'` directly | Always use `hasPermission(roles, permission)` — user may have multiple roles |
| Assume role inheritance (manager has coach perms) | Roles are discrete — combined capabilities require combined roles |
| Parse roles with `as` casting or manual split | Always use `parseRoles()` from `backend/src/lib/roles.ts` — Zod validates and discards invalid |
| Sequential dashboard queries | Always `Promise.all` for stats queries |
| Public signup in athlete-pwa | Only `/invite/{token}` — no registration without invitation |
| localStorage for workout logs | Online-only for now — no premature complexity |
| Shared UI components between apps | Copy, don't share — UX diverges by design |
| Define OrganizationRole or parseRoles in contracts | Contracts are API boundary schemas. Role parsing is a backend infrastructure concern. Domain defines the type, backend does the parsing |

## Project Structure & Boundaries

### Existing Structure Reference

The complete existing project structure is documented in `docs/source-tree-analysis.md`. This section covers ONLY additions and modifications needed for remaining MVP features.

### New & Modified Files

**`packages/core` — Domain additions:**
```
packages/core/src/
  services/authorization.ts         # MODIFY: OrganizationRole type + hasPermission(OrganizationRole[])
  ports/
    payment-gateway.port.ts         # NEW: PaymentGatewayPort interface (Phase 4)
```

**`packages/backend` — Application layer additions:**
```
packages/backend/src/
  lib/
    roles.ts                        # NEW: parseRoles() — Zod parsing of DB role string
    context.ts                      # MODIFY: role → roles: OrganizationRole[]
  procedures/
    dashboard/                      # NEW domain
      index.ts
      get-summary.ts
  use-cases/
    dashboard/                      # NEW domain
      get-dashboard-summary.ts
  infrastructure/
    services/
      payment/                      # NEW (Phase 4)
        mercadopago.adapter.ts
        payment-gateway.factory.ts
```

**`packages/contracts` — Cleanup:**
```
packages/contracts/src/
  common/
    roles.ts                        # MODIFY: remove role parsing, keep only if API output needs role type
```

### New App: `apps/athlete-pwa`

```
apps/athlete-pwa/
├── src/
│   ├── main.tsx                    # App entry: TanStack Router + QueryClient
│   ├── env.ts                      # Validated VITE_* env vars
│   ├── routeTree.gen.ts            # Auto-generated (TanStack Router)
│   │
│   ├── routes/
│   │   ├── __root.tsx              # Root layout: QueryClientProvider + Toaster
│   │   ├── index.tsx               # / → redirect based on session state
│   │   ├── login.tsx               # /login (existing users only)
│   │   ├── invite/
│   │   │   └── $token.tsx          # /invite/{token} — signup + accept flow
│   │   ├── _authenticated.tsx      # Auth guard
│   │   └── _authenticated/
│   │       ├── home.tsx            # Today's workout / program overview
│   │       ├── history.tsx         # Training history + PRs
│   │       ├── workout/
│   │       │   └── $sessionId.tsx  # Active workout logging
│   │       └── profile.tsx         # Athlete profile
│   │
│   ├── features/
│   │   ├── auth/
│   │   │   ├── components/         # LoginForm, InviteSignupForm, InviteAcceptView
│   │   │   └── views/
│   │   ├── workout/
│   │   │   ├── components/         # ExerciseCard, SetRow, WorkoutSummary
│   │   │   ├── hooks/
│   │   │   │   ├── mutations/      # useSaveLog
│   │   │   │   └── queries/        # useWorkoutLog, useLogBySession
│   │   │   └── views/              # ActiveWorkoutView
│   │   ├── programs/
│   │   │   ├── components/         # ProgramCard, SessionList
│   │   │   ├── hooks/queries/      # usePrograms, useProgram
│   │   │   └── views/              # ProgramsView
│   │   └── history/
│   │       ├── components/         # LogCard, PRBadge, ProgressChart
│   │       ├── hooks/queries/      # useAthleteLogs, usePersonalRecords
│   │       └── views/              # HistoryView
│   │
│   ├── components/
│   │   ├── ui/                     # Copied shadcn/ui primitives (independent from coach-web)
│   │   ├── layout/
│   │   │   ├── app-shell.tsx       # Mobile shell with bottom nav
│   │   │   └── bottom-nav.tsx      # Bottom tab bar (max 4 tabs)
│   │   └── shared/                 # Skeleton loaders, error states, retry
│   │
│   ├── contexts/
│   │   └── auth-context.tsx        # Session + org context
│   │
│   ├── lib/
│   │   ├── api-client.ts           # oRPC client (same pattern as coach-web)
│   │   ├── auth-client.ts          # Better-Auth client
│   │   ├── auth-cache.ts           # Session cache (5-min TTL)
│   │   ├── query-client.ts         # TanStack Query config
│   │   ├── api-errors.ts           # handleMutationError
│   │   └── utils.ts                # cn(), etc.
│   │
│   └── hooks/                      # Shared hooks
│
├── public/
│   ├── manifest.json               # PWA manifest
│   └── icons/                      # App icons (192, 512)
│
├── e2e/                            # Playwright E2E (same pattern as coach-web)
│   └── mocks/
├── index.html
├── vite.config.ts                  # Includes vite-plugin-pwa
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

### Architectural Boundaries

**API boundary — single backend, two frontends:**
```
apps/coach-web  ──HTTP──┐
                        ├──→ packages/backend (Hono + oRPC)
apps/athlete-pwa ──HTTP──┘     ├── Same procedures
                               ├── Same auth middleware
                               ├── Role-based data filtering via OrganizationRole[]
                               └── Athlete endpoints filter by linkedUserId
```

**Package boundaries (unchanged):**
```
core (zero deps) → database → auth → backend → contracts → apps
```

**Data boundaries:**
- Coach sees: all athletes, all programs, all logs in their org
- Athlete sees: only their assigned programs, only their own logs
- Manager sees: org settings, members, billing, athlete list (read-only)
- Owner sees: everything

### Feature-to-Structure Mapping

| Feature (PRD Phase) | Backend Location | Coach Web Location | Athlete PWA Location |
|---------------------|-----------------|-------------------|---------------------|
| RBAC refactor (P1) | `core/services/`, `backend/lib/` | — (transparent) | — (transparent) |
| Settings page (P1) | `backend/procedures/organizations/` | `features/settings/` (new) | — |
| Coach invitation (P1) | `backend/use-cases/organizations/` | `features/settings/` | — |
| Program templates (P2) | `backend/use-cases/programs/` (exists) | `features/programs/` (exists) | — |
| Coach workout logging (P2) | `backend/use-cases/workout-logs/` (exists) | `features/workout-logs/` (exists) | — |
| Dashboard (P2) | `backend/procedures/dashboard/` (new) | `features/dashboard/` (modify) | — |
| PWA app shell (P3) | — | — | `routes/`, `components/layout/` |
| PWA invite flow (P3) | `backend/procedures/athletes/` (exists) | — | `routes/invite/$token.tsx` |
| PWA workout logging (P3) | `backend/procedures/workout-logs/` (exists) | — | `features/workout/` |
| PWA history + PRs (P3) | `backend/procedures/workout-logs/` (exists) | — | `features/history/` |
| Payment integration (P4) | `core/ports/`, `backend/infrastructure/services/payment/` | `features/auth/` (onboarding) | — |

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
All technology choices are production-tested and internally consistent. The RBAC evolution (Owner/Manager/Coach/Athlete) aligns with the multi-role storage strategy (comma-separated in `members.role`). The payment adapter pattern uses `ResultAsync` consistent with the error handling pipeline. PWA technology choices mirror coach-web patterns (React + Vite + TanStack).

**Pattern Consistency:**
`OrganizationRole` naming is used consistently across core, backend, and contracts. Error handling follows the established layer taxonomy (domain → use case → procedure → frontend). Clean Architecture flow (Entity → Port → Repo → Use Case → Contract → Procedure) applies uniformly to all new features.

**Structure Alignment:**
Package boundaries (`core → database → auth → backend → contracts → apps`) are respected by all new components. The athlete-pwa structure follows coach-web conventions while maintaining UI independence.

### Requirements Coverage Validation ✅

**Functional Requirements Coverage (56 FRs):**

| FR Range | Domain | Coverage |
|----------|--------|----------|
| FR1-FR15 | Program Management | Existing implementation — no new architectural decisions needed |
| FR16-FR18 | Exercise Library | Existing implementation |
| FR20-FR24 | Athlete Management | Existing + invitation flow refined in PWA auth architecture |
| FR25-FR31 | Workout Logging | Online-only PWA strategy decided. PR detection deferred (see open questions) |
| FR32-FR34 | Dashboard & Analytics | `dashboard/summary` endpoint + hybrid data strategy documented |
| FR35-FR39 | Organization & Team | RBAC evolution + settings covered |
| FR40-FR44 | Auth & Authorization | RBAC refactor + PWA auth flow + multi-tenant isolation |
| FR45-FR49 | Athlete PWA | Full scaffold, invite flow, workout logging, history |
| FR50-FR54 | Subscription & Billing | Payment adapter pattern + plan limit enforcement pattern |
| FR55 | User Profile | Simple feature, no architectural decisions needed |
| FR56 | Onboarding | Multi-step flow on single route (already implemented) |

**Non-Functional Requirements Coverage:**

| NFR | Architectural Support |
|-----|----------------------|
| Grid keyboard < 50ms | Existing Zustand store + React 19 — no change needed |
| Program aggregate < 1s | Existing JSONB + single aggregate query |
| PWA initial load < 3s | Vite + code splitting + service worker via vite-plugin-pwa |
| Workout logging < 200ms | Online-only direct POST — no local caching overhead |
| Multi-tenant isolation | OrganizationContext on every repository + RLS safety net |
| Session security | Better-Auth HttpOnly + Secure cookies, 5-min TTL cache |

### Resolved Issues

**1. PRD "Admin" vs Architecture "Manager" (Naming Divergence)**

The PRD defines roles as "Owner > Admin > Coach > Athlete" (FR43). During architectural discovery, "Admin" was deliberately renamed to **"Manager"** to better reflect the role's purpose: organizational operations (settings, billing, member management) without coaching capabilities. This avoids the ambiguity of "Admin" implying system-level access or inheriting all lower-role permissions.

**For implementation:** The PRD's "Admin" references map to `manager` in code. The architecture document is the source of truth for role naming.

**2. Onboarding Flow (FR56)**

The onboarding flow is a multi-step wizard on a single route (already implemented). Steps: plan selection → payment → organization creation. No additional architectural decisions needed — the existing route and step-based UI pattern handles this.

**3. Plan Limit Enforcement Pattern (FR52)**

Plan limits (max athletes, max coaches) are enforced at the use case layer as a pre-condition check before resource creation:

```typescript
// Pattern: check plan limits in use case before creating resource
// 1. Fetch current org's plan limits
// 2. Count existing resources (athletes/coaches)
// 3. If count >= limit, return err({ type: 'plan_limit_reached', resource: 'athletes', limit, current })
// 4. Procedure maps to oRPC FORBIDDEN with upgrade prompt message
```

This applies to: `createAthlete`, `inviteCoach`, and any future resource-creation use cases that are plan-gated.

### Open Questions (Deferred)

**PR Detection Strategy (FR31, FR49)**

Personal records are deferred for detailed design. Current thinking:

- **Scope:** Not all exercises warrant PR tracking. A curated subset of "PR-eligible" exercises makes more sense (e.g., compound lifts). This could be configurable by coach/owner per organization in a future iteration.
- **Storage trade-off (to evaluate):**
  - **Option A:** Store entire workout as JSONB + maintain a separate `personal_records` table updated on each workout log save. Simpler workout storage, explicit PR tracking.
  - **Option B:** Store each series/set as an individual row. PRs computed via query aggregation. More granular data, more flexible queries, but higher storage and query complexity.
- **Trigger:** PR evaluation happens at workout log save time — the save use case checks if any logged values exceed the athlete's previous best for PR-eligible exercises.
- **Decision point:** Evaluate when implementing Phase 3 workout logging, with real data model context.

### Architecture Completeness Checklist

**✅ Requirements Analysis**

- [x] Project context thoroughly analyzed (56 FRs, 6 NFRs)
- [x] Scale and complexity assessed (medium-high, brownfield SaaS)
- [x] Technical constraints identified (10 constraints documented)
- [x] Cross-cutting concerns mapped (7 concerns)

**✅ Architectural Decisions**

- [x] Critical decisions documented (RBAC, PWA auth, workout persistence)
- [x] Technology stack fully specified (confirmed, brownfield)
- [x] Integration patterns defined (oRPC, Better-Auth, payment adapter)
- [x] Performance considerations addressed (PWA load, workout logging latency)

**✅ Implementation Patterns**

- [x] Naming conventions established (OrganizationRole, file naming, function naming)
- [x] Structure patterns defined (Clean Architecture flow, frontend flow)
- [x] Communication patterns specified (oRPC wire format, error handling pipeline)
- [x] Process patterns documented (TDD cycle, quality gate, incremental delivery)

**✅ Project Structure**

- [x] Complete directory structure defined (athlete-pwa scaffold)
- [x] Component boundaries established (package deps, data boundaries)
- [x] Integration points mapped (single backend, two frontends)
- [x] Requirements to structure mapping complete (feature-to-structure table)

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High — brownfield project with established patterns. New decisions are scoped and well-bounded.

**Key Strengths:**
- Existing Clean Architecture provides clear extension points for all remaining features
- RBAC multi-role model is detailed with permission matrix, parsing pattern, and anti-patterns
- PWA architecture leverages existing backend entirely — no new API surface required
- Payment adapter pattern enables provider-agnostic implementation
- 67 existing project-context rules + architecture anti-patterns minimize agent drift

**Areas for Future Enhancement:**
- PR detection data model (deferred to Phase 3 implementation)
- Offline/localStorage workout caching (evolve if gym connectivity is problematic)
- PWA push notifications architecture (post-MVP)
- Detailed onboarding UX specification if flow needs modification

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions exactly as documented
- The architecture document supersedes the PRD for implementation details (e.g., "Manager" not "Admin")
- Use implementation patterns consistently across all components
- Respect project structure and boundaries
- Refer to `project-context.md` for the full 67-rule set; this document covers only new/supplementary decisions
- For open questions (PR detection), do not implement until the decision is made

**Implementation Sequence (updated 2026-03-20):**
1. RBAC refactor (OrganizationRole multi-role) — touches core, backend. Must be first. **NOT STARTED**
2. Settings page + coach invitation — builds on RBAC. **NOT STARTED**
3. Program grid bug fixes — 15+ known issues in `bugs&todo.md`. **NOT STARTED**
4. Custom exercise create/edit UI — backend ready, frontend missing. **NOT STARTED**
5. Dashboard summary endpoint — new use case + procedure. **NOT STARTED** (frontend shell exists with basic athlete stats)
6. Athlete PWA scaffold — new app, copies UI components. **NOT STARTED** (`apps/athlete-pwa/` does not exist)
7. PWA invite flow — builds on existing invitation backend. **NOT STARTED**
8. PWA workout logging — online-only, reuses existing backend. **NOT STARTED**
9. PWA history + PRs — deferred PR detection design decision. **NOT STARTED**
10. Payment integration — Phase 4, after provider decision. **NOT STARTED**

**Already completed (not in original sequence):**
- Program templates (save-as-template, create-from-template) — backend + frontend done
- Coach-side workout logging — backend done, frontend partially done
- Athlete invitation flow — backend done, frontend modal done
