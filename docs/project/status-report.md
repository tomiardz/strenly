# Strenly — Project Status Report

**Last updated:** 2026-03-20
**Assessed by:** Full codebase analysis (not docs-only)

## Overall Progress

| Phase | Status | Completion |
|-------|--------|------------|
| Brownfield (pre-existing) | Mostly done | ~85% |
| Phase 1 — Foundations & RBAC | Not started | 0% |
| Phase 2 — Coach Web Completion | Partially done | ~35% |
| Phase 3 — Athlete PWA | Not started | 0% |
| Phase 4 — Monetization | Not started | 0% |

**Estimated MVP completion: ~45%**

The backend is significantly more advanced than the frontend. Architecture foundations are solid (Clean Architecture, 50 use cases, 49 procedures, 9 repositories), but user-facing features are incomplete and the Athlete PWA does not exist.

---

## Inventory: What's Built

### Backend (5 domains, fully operational)

| Domain | Use Cases | Procedures | Repositories | Unit Tests |
|--------|-----------|------------|--------------|------------|
| Athletes | 10 | 11 | 2 (athlete + invitation) | 11 |
| Programs | 21 | 15 | 1 (1919 lines) | 20 |
| Exercises | 7 | 9 | 2 (exercise + muscle-group) | 7 |
| Workout Logs | 7 | 9 | 1 (555 lines) | 7 |
| Subscriptions | 5 | 5 | 2 (plan + subscription) | 5 |
| **Total** | **50** | **49** | **9** | **50** |

### Core Domain

- 5 top-level entities: Athlete, Exercise, Plan, Subscription, AthleteInvitation
- 2 complex aggregates: Program (9 files, 1685 lines), WorkoutLog (6 files, 585 lines)
- 2 value objects: MuscleGroup, MovementPattern
- 8 ports (repository interfaces)
- Authorization service: 3 roles, 20 permissions
- 16 test files, 5573 lines of tests

### Contracts

- 30 schema files across 7 domains
- Consistent pattern: entity schema → input/query/output derivations
- List responses always `{ items, totalCount }`
- 1 test file (prescription notation parsing)

### Database

- 22+ tables, 7 enums, 4 migrations
- Seed data: test user, plans, muscle groups, exercises, athletes + programs
- ID prefixes: `prg-`, `week-`, `sess-`, `eg-`, `pex-`, `rx-`, `log-`, `lex-`

### Coach Web Frontend

| Feature | Route | Views | Components | Mutation Hooks | Query Hooks | E2E Tests |
|---------|-------|-------|------------|----------------|-------------|-----------|
| Auth | `/login`, `/signup`, `/onboarding` | 3 | 8 | 1 | 0 | 0 |
| Athletes | `/$orgSlug/athletes/**` | 2 | 4 | 4 | 3 | 0 |
| Programs | `/$orgSlug/programs/**` | 3 | 4 + 14 grid + 7 toolbar | 8 | 4 | 19 specs |
| Exercises | `/$orgSlug/exercises` | 1 | 3 | 0 | 2 | 0 |
| Workout Logs | `/$orgSlug/athletes/$id/logs/**` | 2 | 6 | 3 | 3 | 0 |
| Dashboard | `/$orgSlug/dashboard` | 1 | 3 | 0 | 1 custom | 0 |
| Subscriptions | (onboarding only) | 0 | 1 | 0 | 1 | 0 |

### Shared Infrastructure

- 27 shadcn/ui primitives, 7 data-table components, 5 layout components
- 2 Zustand stores: grid-store (with undo/redo), log-store
- 2 React contexts: auth, organization
- 4 shared hooks: debounce, mobile detection, org slug, unsaved changes
- Playwright mock infrastructure: setup-mocks, 4 mock modules, 1 page object

---

## Inventory: What's Missing

### RBAC — Still on old 3-role model (BLOCKER for Phase 1, 3)

**Current state in code:**
- `core/services/authorization.ts`: `Role = 'owner' | 'admin' | 'member'` — 3 roles only
- `contracts/common/roles.ts`: `MemberRole = 'owner' | 'admin' | 'member'`
- `backend/lib/context.ts`: `membership: { id: string; role: MemberRole }` — single role, not array
- `hasPermission(role: Role, permission)` — takes single role, not `OrganizationRole[]`
- `backend/src/lib/roles.ts` does NOT exist

**Required by architecture doc:**
- 4 roles: `owner | manager | coach | athlete`
- Multi-role support: comma-separated in DB, parsed to `OrganizationRole[]`
- `parseRoles()` function in `backend/src/lib/roles.ts`
- `hasPermission(roles: OrganizationRole[], permission)` — accepts array

**Impact:** No `athlete` role → can't build PWA permissions. No `coach` role → members can't write programs/exercises.

### Settings Page — Does not exist

- No `/settings` route
- No organization config UI
- No member management (invite coaches, assign roles, remove members)
- No profile editing (FR55)

### Dashboard — Minimal, no backend

**Current state:** `useDashboardStats()` hacks 3 stats from athlete list queries (total, active, pending invitations). `RecentActivity` shows last 5 athletes. `QuickActions` has static links.

**Missing:**
- No `dashboard/summary` backend endpoint
- No program status counts (draft/active/archived) — FR33
- No session completion data — FR32
- No payment/membership status visibility — FR34
- No real activity feed (workout logs, training completions)

### Exercises — Read-only in frontend

Backend is complete (7 use cases: create, update, archive, clone, list, get, muscle-groups). Frontend only has browse/filter view.

**Missing:**
- Create custom exercise form — FR17
- Edit exercise form — FR18
- No mutation hooks (`use-create-exercise`, `use-update-exercise`, etc.)

### Program Editor — 15+ known bugs

The grid editor is the most complete feature (19 E2E specs, Zustand store with undo/redo), but `bugs&todo.md` lists active issues:

**Functional bugs:**
- Ctrl+G superset doesn't toggle exercise out of group
- Can't reorder exercises inside a superset
- Delete week still calls backend (should be client-side only)
- Summary of weeks/sessions doesn't update on changes
- "Guardado" status doesn't reflect pending changes

**UI/UX bugs:**
- Grid borders/z-index broken (superset indicator, focus outline behind elements)
- Focus scroll broken when navigating backward to cells behind fixed columns
- Breadcrumb shows program UUID instead of name
- "Pairing / Exercise Selection" column header in English
- Invalid cell warning obscured by focus border
- Save dialog text cutoff on validation errors
- Layout padding issues

**Missing features:**
- Keyboard shortcuts for add/remove week/day
- Day row context menu (edit name, delete)
- Click on name to open editor (currently only via action menu)
- Program creation form too long, needs redesign

### Workout Logging — Functional but incomplete UX

Backend complete (7 use cases including pending workouts). Frontend has logging grid + history.

**Missing:**
- Session selection UX from athlete profile is not intuitive
- Coach-side "log on behalf" flow needs clearer navigation path

### Athlete PWA — Does not exist (0%)

`apps/athlete-pwa/` is not in the filesystem. 100% greenfield.

`packages/auth` has trusted origins for `localhost:5174` and `athlete.strenly.com.ar` (anticipated but never created).

`apps/marketing/` also empty (only `.gitkeep`).

### Monetization — Foundation only

**Exists:** Plan entity, Subscription entity, plan limit checks (`checkAthleteLimit`, `checkFeatureAccess`), plan selection in onboarding, seed data with plans.

**Missing:** Payment provider decision, `PaymentGatewayPort`, checkout flow, paywall enforcement, billing UI. Subscription is created without real payment.

---

## Test Coverage

| Area | Unit Tests | E2E Tests | Assessment |
|------|-----------|-----------|------------|
| Core entities | 16 files, 5573 lines | — | Strong |
| Backend use cases | 50 tests across 5 domains | — | Strong |
| Contracts | 1 test (prescription) | — | Minimal |
| Frontend stores | 1 test (grid undo/redo) | — | Minimal |
| Program Grid | — | 19 spec files | Strong |
| Auth flows | — | 0 | No coverage |
| Athletes CRUD | — | 0 | No coverage |
| Exercise browser | — | 0 | No coverage |
| Workout logging UI | — | 0 | No coverage |
| Dashboard | — | 0 | No coverage |

**Totals:** ~69 unit tests + 19 E2E spec files (containing multiple tests each)

---

## FR Coverage Analysis

### Covered (implemented in backend + frontend)

- FR1-FR11: Program CRUD, grid editing, keyboard navigation, weeks/sessions/prescriptions, exercise rows, inline search, reorder
- FR12: Exercise grouping (supersets) — backend done, UI has bugs
- FR13-FR14: Program templates — save as template, create from template
- FR15: Program list with search, filter, pagination
- FR16: Exercise library browser with search, filters by muscle group and movement pattern
- FR20-FR21: Athlete CRUD + list with search, status filter, pagination
- FR22-FR23: Athlete invitation generation + status display
- FR24: Program-to-athlete assignment (via program form)
- FR25-FR26: Coach-side workout logging + history view
- FR27: Athlete can view assigned workout with pre-loaded prescriptions (backend only — no PWA)
- FR28-FR29: Workout logging with adjust/RPE (backend only)
- FR35: Organization creation (in onboarding)
- FR40-FR42: Sign up, sign in, sign out
- FR44: Multi-tenant data isolation
- FR50: View available plans (in onboarding)
- FR51: Subscribe to plan (mock, no payment)
- FR56: Onboarding flow (plan → org creation)

### Backend done, frontend missing

- FR17-FR18: Create/edit custom exercises — backend has use cases, no frontend forms
- FR30-FR31: Athlete workout history + PR detection — backend has `listAthleteLogs`, no PWA or PR logic
- FR52: Plan limit enforcement — `checkAthleteLimit` and `checkFeatureAccess` use cases exist

### Not started

- FR32-FR34: Dashboard with real data (program status, session completion, payment status)
- FR36-FR38: Coach invitation, team management, member removal
- FR39: Organization settings page
- FR43: RBAC enforcement (4-role model not implemented)
- FR45-FR49: All Athlete PWA features (invite acceptance, view programs, log workouts, history, PRs)
- FR53-FR54: Payment status view, payment transaction
- FR55: User profile editing

---

## Dependency Graph

```
RBAC Refactor (Phase 1) ─────────────────────────┐
  ├── blocks → Settings Page                       │
  ├── blocks → Coach Invitation                    │
  ├── blocks → Athlete PWA (needs athlete role)    │
  └── blocks → proper permission enforcement       │
                                                   │
Grid Bug Fixes (Phase 2) ─────────────┐           │
  └── should stabilize before PWA      │           │
      relies on program data           │           │
                                       ▼           ▼
Dashboard Backend (Phase 2)    Athlete PWA Scaffold (Phase 3)
  └── needs workout log data     └── needs RBAC first
      for completion stats
                                 PR Detection Design Decision
                                   └── blocks PWA History (Phase 3)

Payment Provider Decision
  └── blocks all of Phase 4
```

---

## Strengths

- Clean Architecture consistently applied across all 5 backend domains
- Domain entities with exhaustive validation and factory pattern
- Excellent test coverage on core (5573 lines) and backend (50 use cases tested)
- Program aggregate is sophisticated (5-level hierarchy, custom prescription notation parser, undo/redo)
- Grid editor with 19 E2E spec files is the standout feature
- Contracts package well organized as single source of truth
- Multi-tenancy consistently enforced via `organizationId`
- Complete seed data for development

## Risks

- **RBAC refactor is invasive** — touches core, contracts, backend, context, and every use case calling `hasPermission()`
- **Grid bugs unresolved** — the flagship feature has 15+ known issues
- **Zero E2E outside the grid** — regressions in auth, athletes, or logging go undetected
- **Athlete PWA is 100% greenfield** — Phase 3 estimation is the most uncertain
- **Solo developer** — no margin for error on large architectural changes
- **Docs are outdated** — PRD and architecture docs describe planned state, not actual state
