# Strenly — MVP Roadmap

**Created:** 2026-03-20
**Starting point:** ~45% MVP completion (see `status-report.md` for full inventory)
**Target:** Complete MVP — coach creates program → athlete trains with it → coach sees results

---

## Phase 1 — RBAC Refactor

> Unblocks settings, member management, and the entire Athlete PWA. This is the single highest-leverage change remaining.

**Why first:** 46 use cases and 34 procedures use the current 3-role model. The architecture doc defines a 4-role model with multi-role support. Every feature built on the old model will need rework later. The refactor is mechanical and well-specified — better to do it once, now.

### 1.1 — Core authorization migration

Migrate `authorization.ts` from 3-role (`owner/admin/member`) to 4-role (`owner/manager/coach/athlete`) with multi-role support.

**Scope:**
- `packages/core/src/services/authorization.ts` — new `OrganizationRole` type, updated permission matrix, `hasPermission()` accepts `OrganizationRole[]`
- `packages/core/src/types/organization-context.ts` — `memberRole: Role` → `roles: OrganizationRole[]`
- `packages/core/src/services/__tests__/authorization.test.ts` — updated for 4 roles + multi-role scenarios

**Permission matrix (from architecture doc):**

| Permission | owner | manager | coach | athlete |
|------------|-------|---------|-------|---------|
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

**Key design decisions:**
- Roles are discrete — no inheritance. Combined capabilities require combined roles (e.g., `"manager,coach"`)
- `owner` has ALL permissions (superset)
- `manager` manages org but does NOT have coach permissions
- `coach` programs and works with athletes but does NOT manage org
- `athlete` only accesses own data and logs workouts
- `hasPermission(roles[], permission)` returns true if ANY role grants the permission

### 1.2 — Backend role parsing + context migration

Create `parseRoles()` and update the auth middleware context.

**Scope:**
- NEW `packages/backend/src/lib/roles.ts` — `parseRoles(roleString): OrganizationRole[]` (split comma-separated DB value, validate with Zod, discard invalid)
- `packages/backend/src/lib/context.ts` — `membership.role: MemberRole` → `membership.roles: OrganizationRole[]`
- `packages/backend/src/lib/orpc.ts` — `authProcedure` calls `parseRoles()` to build context
- `packages/contracts/src/common/roles.ts` — update `MemberRole` schema or replace with `OrganizationRole`

### 1.3 — Use case + procedure migration

Update all 46 use cases and 34 procedures to use the new role model.

**Scope:**
- 46 use case files: change `hasPermission(input.memberRole, permission)` → `hasPermission(input.roles, permission)`
- 34 procedure files: change `memberRole: context.membership.role` → `roles: context.membership.roles`
- Backend test helpers: `createTestContext()`, `createAdminContext()`, etc. → update for new roles
- Backend test factories: update all mock contexts

**Pattern is 100% consistent across all files — mechanical find-and-replace with type checking.**

### 1.4 — Verify

- Run `pnpm typecheck && pnpm lint` — must pass
- Run `pnpm test` — all 69+ unit tests must pass
- Run E2E grid tests — must pass (grid doesn't check roles but uses auth context)

---

## Phase 2 — Settings & Organization Management

> First user-facing value from the RBAC refactor. Coaches can manage their team.

### 2.1 — Profile page

User can view and edit their profile (name, avatar). FR55.

**Scope:**
- Backend: minimal — Better-Auth handles user updates via `/api/auth/update-user`
- Frontend: new route `/$orgSlug/settings/profile`, form with name + avatar fields
- Hook: mutation calling Better-Auth client directly (not oRPC)

### 2.2 — Organization settings page

Organization config and member list. FR35, FR37, FR39.

**Scope:**
- Frontend: new route `/$orgSlug/settings`, tabs for "General" + "Team"
- General tab: org name (editable by owner/manager)
- Team tab: member list with roles, invitation status
- Better-Auth provides `organization.update()`, `organization.listMembers()` via client SDK

### 2.3 — Coach invitation flow

Admin/owner can invite coaches via shareable link. FR36, FR38.

**Scope:**
- Backend: Better-Auth's organization plugin already supports member invitations (`organization.inviteMember()`)
- Frontend: "Invite Coach" button in Team tab → generates link with role pre-set
- Role assignment UI (owner can change roles of members)
- Remove member action (owner/manager)

---

## Phase 3 — Coach Web Completion

> Complete the remaining coach-web features that don't depend on the PWA.

### 3.1 — Custom exercise CRUD UI

Create and edit forms for custom exercises. FR17, FR18.

**Scope:**
- Backend: already done (7 use cases, 9 procedures)
- Frontend: new mutation hooks (`use-create-exercise`, `use-update-exercise`, `use-archive-exercise`, `use-clone-exercise`)
- Frontend: exercise form component (name, description, instructions, video URL, movement pattern, muscle groups, unilateral toggle)
- Frontend: create button in exercise browser, edit action in exercise row
- Frontend: archive/clone actions

### 3.2 — Dashboard with real data

Dashboard showing real stats. FR32, FR33, FR34.

**Scope:**
- Backend: new `dashboard/summary` use case + procedure returning aggregated stats via `Promise.all` count queries
- Stats: total athletes, active athletes, programs by status (draft/active/archived), sessions completed this week, recent activity (workout logs)
- Frontend: replace current `useDashboardStats()` hack with real endpoint
- Frontend: add program status cards, activity feed with real workout log data

### 3.3 — Workout logging UX polish

Improve the coach-side logging flow. FR25, FR26.

**Scope:**
- Clearer navigation path: athlete detail → select session → log workout
- Pending workouts list accessible from athlete detail
- Session summary improvements

---

## Phase 4 — Athlete PWA

> The biggest greenfield chunk. Build the mobile app from scratch. Backend is mostly ready.

### 4.1 — Scaffold + app shell

Create `apps/athlete-pwa/` with base infrastructure.

**Scope:**
- Vite + React 19 + TanStack Router + TanStack Query
- `vite-plugin-pwa` for service worker + manifest
- oRPC client setup (same pattern as coach-web)
- Better-Auth client (session management)
- Mobile-first layout: bottom tab bar (max 4 tabs), app shell
- Copy shadcn/ui primitives from coach-web (independent, not shared)
- Skeleton loaders, error states with retry, loading states
- Auth context + org context
- Touch targets minimum 44x44px
- Deploy target: Vercel at `athlete.strenly.com.ar`

### 4.2 — Invite + auth flow

Athlete joins via invitation link. FR45.

**Scope:**
- Route: `/invite/$token` — single route handles both auth states
- Unauthenticated: show org info → signup form (email + password) → auto-accept invitation → redirect home
- Authenticated: show org info → "Accept" button → redirect home
- Route: `/login` — for returning athletes
- No public `/signup` — athletes can only join via invitation
- Backend: reuses existing `getInvitationInfo` (public) + `acceptInvitation` (authenticated)

### 4.3 — Home + view workouts

Athlete sees their programs and today's workout. FR46, FR47.

**Scope:**
- Home screen: today's workout (current program, current week's sessions)
- Program list: assigned programs with status
- Session view: exercises with pre-loaded prescriptions (sets, reps, intensity)
- Backend: reuses existing `programs.get`, `programs.list` (filtered by athlete's linkedUserId)
- May need a convenience endpoint: "get today's workout for athlete"

### 4.4 — Workout logging

Athlete logs their workout. FR27, FR28, FR29.

**Scope:**
- Pre-loaded prescriptions from coach's program
- Confirm or adjust: reps, weight, RPE per set
- Each save is an immediate POST (online-only, no batching)
- Session RPE and notes (optional)
- Error UI on connection loss with retry
- Backend: reuses existing `workoutLogs.createLog`, `workoutLogs.saveLog`

### 4.5 — Training history

Athlete browses past workouts. FR30, FR48.

**Scope:**
- Log history list with date, session name, status
- Log detail view showing exercises and actual vs prescribed
- Progress visualization (volume/weight trends per exercise)
- Backend: reuses existing `workoutLogs.listAthleteLogs`, `workoutLogs.getLog`

### 4.6 — Personal records (design decision required)

Automatic PR detection. FR31, FR49.

**Open question from architecture doc — must resolve before implementing:**
- Which exercises are PR-eligible? (curated subset vs all)
- Storage: separate `personal_records` table vs computed from log data?
- Trigger: evaluate at log save time or compute on read?

**Scope (once decision is made):**
- Backend: PR detection logic in workout log save use case or dedicated use case
- Frontend: PR badge on exercises, PR list view

---

## Phase 5 — Grid Polish

> Batch-fix the 15+ known issues. Can be interleaved with other phases as needed.

### 5.1 — Functional fixes

From `bugs&todo.md`:
- Ctrl+G superset creation doesn't toggle exercise out
- Can't reorder exercises inside a superset
- Delete week still calls backend (should be client-side)
- Summary of weeks/sessions doesn't update on grid changes
- "Guardado" status doesn't reflect pending changes

### 5.2 — UI/UX fixes

- Grid borders/z-index (superset indicator, focus outline behind elements)
- Focus scroll when navigating backward to cells behind fixed columns
- Breadcrumb shows UUID instead of program name
- "Pairing / Exercise Selection" column header in English
- Invalid cell warning obscured by focus border
- Save dialog text cutoff on validation errors
- Layout padding issues

### 5.3 — Missing interactions

- Keyboard shortcuts: add/remove week/day, focus new day
- Day row context menu (edit name, delete, move)
- Click on program name in list to open editor directly
- Program creation form redesign (too long, needs audit)

---

## Phase 6 — Monetization (Deferred)

> Blocked by payment provider decision. Can begin once provider is chosen.

### 6.1 — Payment gateway adapter

- `PaymentGatewayPort` in `packages/core/src/ports/`
- Adapter implementation in `packages/backend/src/infrastructure/services/payment/`
- Interface: `createCheckout()`, `handleWebhook()`, `getPaymentStatus()`
- Normalized domain events: `payment_confirmed`, `payment_failed`, `subscription_cancelled`

### 6.2 — Checkout + paywall

- Real payment flow in onboarding (replace mock subscription creation)
- Paywall enforcement: block actions when plan limits reached with upgrade prompt
- Billing management page (view subscription, change plan)
- Webhook handler for payment confirmations

### 6.3 — Payment status visibility

- Athlete payment/membership status in coach-web (athlete list, detail view)
- FR34, FR53

---

## Post-MVP (not sequenced)

- Reporting and analytics (detailed coach dashboards, athlete progress charts)
- Centralized messaging between coach and athletes
- Gamification and engagement features for athletes
- Program template sharing between coaches
- Notification system (training reminders, payment alerts)
- Email-based invitations (replace link-only)
- Multi-gym athlete support
- AI copilot (learns coach's programming style)

---

## Dependency Map

```
Phase 1 (RBAC)
  │
  ├──→ Phase 2 (Settings + Members)
  │
  ├──→ Phase 3 (Coach Web)     ← no RBAC dependency, can overlap with Phase 2
  │
  └──→ Phase 4 (Athlete PWA)   ← needs RBAC for athlete role
        │
        └──→ Phase 4.6 (PRs)   ← needs design decision

Phase 5 (Grid Polish)          ← independent, can happen anytime

Phase 6 (Monetization)         ← needs payment provider decision, independent of PWA
```

---

## Verification Gates

After each phase, before moving to the next:

1. `pnpm typecheck` — zero errors
2. `pnpm lint` — zero errors
3. `pnpm test` — all unit tests pass
4. E2E tests pass (for phases touching coach-web)
5. Manual smoke test of affected features

---

## Key Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Unit tests (core) | 16 files | Maintain 90%+ coverage |
| Unit tests (backend) | 50 tests | Maintain 80%+ on use cases |
| E2E coverage | Grid only (19 specs) | Add auth, athletes, exercises, logging |
| Roles | 3 (owner/admin/member) | 4 (owner/manager/coach/athlete) + multi-role |
| Coach-web features complete | ~60% | 100% (after Phase 3 + 5) |
| Athlete PWA | 0% | 100% (after Phase 4) |
| Payment integration | Foundation only | Functional (after Phase 6) |
