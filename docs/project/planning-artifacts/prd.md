---
stepsCompleted: ['step-01-init', 'step-02-discovery', 'step-02b-vision', 'step-02c-executive-summary', 'step-03-success', 'step-04-journeys', 'step-05-domain-skipped', 'step-06-innovation-skipped', 'step-07-project-type', 'step-08-scoping', 'step-09-functional', 'step-10-nonfunctional', 'step-11-polish', 'step-12-complete']
status: 'complete'
completedAt: '2026-02-17'
classification:
  projectType: 'SaaS B2B'
  domain: 'Fitness / Sports Tech'
  complexity: 'medium'
  projectContext: 'brownfield'
inputDocuments:
  - '_bmad-output/project-context.md'
  - 'docs/index.md'
  - 'docs/project-overview.md'
  - 'docs/architecture.md'
  - 'docs/data-models.md'
  - 'docs/development-guide.md'
  - 'docs/api-contracts.md'
  - 'docs/integration-architecture.md'
  - 'docs/source-tree-analysis.md'
documentCounts:
  briefs: 0
  research: 0
  brainstorming: 0
  projectDocs: 9
workflowType: 'prd'
---

# Product Requirements Document - Strenly

**Author:** Tomi
**Date:** 2026-02-17

## Executive Summary

Strenly is a training planning platform built to replace Excel as the primary tool for strength coaches. Today, most coaches rely on spreadsheets for programming because they're fast, flexible, and familiar — but Excel breaks down at scale: each athlete lives in a separate file, there's no centralized data, no progress tracking, and no professional client-facing experience. Strenly solves this with a keyboard-first, Excel-like grid editor for program design paired with a mobile athlete app for training execution and progress visualization.

The platform serves two user types: **coaches** (desktop SPA — plan, manage, analyze) and **athletes** (mobile PWA — view workouts, log training, track progress). The current MVP is partially built with core program editing, exercise library, athlete management, and workout logging foundations in place. This PRD defines the remaining MVP scope across both coach and athlete experiences.

Post-MVP, personalized AI will act as a coach's copilot — learning each coach's programming style, rules, and philosophy to help generate progressions and scale their methodology to more athletes.

### What Makes This Special

The program editor feels like Excel — not like a typical fitness app form wizard. Arrow-key navigation, inline editing, keyboard shortcuts — coaches can build a full training program at the same speed they do in a spreadsheet. Most competing platforms fail here because they're designed by developers, not coaches; they force rigid workflows that slow down the creative planning process.

Beyond the editor, Strenly gives coaches what Excel never can: centralized athlete management, training analytics and dashboards, membership/payment tracking, and a branded professional app they can present to clients. For athletes, it replaces the confusion of reading someone else's spreadsheet with a clear, engaging mobile experience — easy access to today's workout, personal records, and progress history.

Coaches don't need another generic fitness app — they need *their* Excel, but better.

### Project Classification

| Attribute | Value |
|-----------|-------|
| **Project Type** | SaaS B2B (multi-tenant, RBAC, subscription tiers) |
| **Domain** | Fitness / Sports Tech |
| **Complexity** | Medium — no regulatory compliance, but complex domain model (Program aggregate with weeks → sessions → groups → prescriptions) |
| **Project Context** | Brownfield — MVP partially implemented. Remaining: complete coach features + full athlete PWA |

## Success Criteria

### User Success

**Coach:**
- A coach can create a full multi-week training program at comparable speed to Excel — without sacrificing Excel's speed or flexibility
- The platform provides a visually polished experience that coaches feel proud to show clients ("this is my app")
- Dashboard surfaces useful, actionable information about their athletes without manual tracking
- Athlete membership and payment status is visible at a glance — no separate spreadsheet for billing
- Coach can log workouts on behalf of athletes who don't use the PWA

**Athlete:**
- An athlete can open the app, see today's workout, and start training within 3 seconds (see PWA load time NFR)
- Training history is browsable — personal records (PRs), past performances, and progress are surfaced automatically
- Logging a workout is completable without interrupting training flow (see workout logging 200ms NFR)

### Business Success

Success is validated through:
- A beta cohort of real strength coaches using the platform for actual client programming
- Qualitative feedback: coaches confirm the platform doesn't sacrifice Excel's speed while giving them extras (dashboard, centralized data, professional client experience)
- Athletes confirm the app is more accessible than receiving Excel files

### Technical Success

- Program grid editor maintains keyboard-first, Excel-like responsiveness even with complex programs (8+ weeks, 5+ sessions)
- Multi-tenant data isolation — zero cross-organization data leaks
- Existing architecture (Clean Architecture + DDD) scales to support remaining MVP features

### Measurable Outcomes

| Outcome | Target |
|---------|--------|
| Program creation speed | Comparable to Excel for an experienced coach (qualitative beta validation) |
| Coach beta satisfaction | Coaches voluntarily continue using Strenly after beta period |
| Athlete workout logging | Athletes can log a full session in under 5 minutes |
| Grid responsiveness | No perceptible lag on keyboard navigation in programs up to 8 weeks × 6 sessions |
| PWA load time | Athlete app initial load < 3 seconds on mobile |

## Product Scope & Development Phases

### MVP Strategy

**Approach:** Experience-first — deliver a complete loop for each user type (coach creates program → athlete trains with it → coach sees results). Each phase adds a functional layer that can be tested independently before moving to the next.

**Resource:** Solo developer (Tomi), AI-assisted development. No external team dependencies. Payment provider decision is the only external blocker (Phase 4).

### Already Implemented (Brownfield)

- Auth + organizations (Better-Auth, multi-tenant)
- Exercise library (curated + custom, muscle groups, movement patterns)
- Program editor grid (keyboard navigation, inline editing, weeks/sessions/prescriptions) — *in testing, near complete*
- Athlete CRUD (create, update, archive)
- Subscription/plan model — *foundation only, no paywall/payments*

### Phase 1 — Foundations & RBAC Audit

- Audit roles and permissions: define Coach and Athlete roles, validate hierarchical model (Owner > Admin > Coach > Athlete)
- Settings page implementation: organization configuration, profile management
- Organization management: coach invitation via shareable link, role assignment
- Athlete invitation flow refinement (coach generates link → athlete accepts in PWA)

### Phase 2 — Coach Web Completion

- Finalize program editor based on testing feedback (grid UX polish, edge cases)
- Program templates: save program as template, create new program from template
- Workout logging from coach side (on behalf of athletes who don't use PWA)
- Dashboard with real data: athlete activity, program status, session completion, key stats
- Athlete membership/payment tracking and status visibility

### Phase 3 — Athlete PWA

- PWA setup: app shell, auth flow, invitation acceptance and account creation
- View assigned training programs and daily workouts
- Workout logging: pre-loaded prescriptions, adjust only what differs, optional RPE per set
- Training history and progress visualization
- Personal records (PRs) automatic surfacing

### Phase 4 — Monetization (Deferred)

- Payment provider integration (MercadoPago or alternative — decision pending)
- Paywall enforcement and subscription billing management

### Post-MVP (Growth)

- Reporting and analytics (detailed coach dashboards, athlete progress charts)
- Centralized messaging between coach and athletes
- Gamification and engagement features for athletes (achievements, streaks)
- Program template sharing between coaches (cross-organization)
- Notification system (training reminders, payment due alerts)
- Email-based invitations (replace link-only flow)
- Multi-gym athlete support (belong to more than one organization)

### Vision

- AI copilot that learns each coach's programming style and philosophy
- AI-assisted progression generation adapted to coach methodology
- Coach-configurable AI personality (planning preferences, internal rules, athlete goals)

### Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Program grid complexity | Iterative testing in Phase 2 before building dependent features |
| Athlete PWA from scratch | Keep simple (view + log + history), reuse existing backend |
| Coaches won't switch from Excel | Beta test with real coaches during Phase 2 to validate grid UX |
| Athlete engagement uncertain | Focus on utility over gamification in MVP |
| Solo developer | Phased approach — each phase delivers testable value independently |
| Payment provider unknown | Deferred to Phase 4, decision made while other phases progress |

## User Journeys

### Journey 1: Coach Creates and Assigns a Training Program

**Persona:** Martín, 32, independent strength coach. Has 15 athletes, currently manages everything in Excel. Each athlete has their own spreadsheet.

**Opening Scene:** Martín opens Strenly on a Sunday evening. He needs to program next week's training for his group of intermediate lifters. In Excel, this means juggling 8 separate files and copy-pasting his base template into each.

**Rising Action:** He opens the program grid for "Intermediate Strength Block - Phase 2." The grid looks familiar — rows of exercises, columns per week, cells for prescriptions. He navigates with arrow keys, types "4x6 @80%" directly into a cell, tabs to the next. He adds a new exercise row, searches "Romanian Deadlift" in the inline combobox, and it drops in. He duplicates Week 3 into Week 4 and adjusts the intensity for the new week.

Once he's happy with the program, he saves it as a template — next month's intermediate block will start from this base instead of from scratch.

**Climax:** He assigns the program to an athlete, goes to the dashboard, and sees all his athletes' status at a glance — who's training this week, who logged their sessions, who hasn't shown up. This is the data he never had in Excel.

**Resolution:** The actual programming time isn't drastically different from Excel — a coach who knows their craft is fast in any tool. But Martín no longer juggles 8 separate files, no longer copy-pastes between spreadsheets, and has all athlete data in one place. The real win isn't speed — it's centralization and the professional experience he can offer his clients.

**Capabilities revealed:** Program grid editor, keyboard navigation, inline exercise search, week duplication, prescription editing, program-to-athlete assignment, dashboard with athlete activity overview, program templates (save and create from template).

### Journey 2: Athlete Receives Invitation and Logs a Workout

**Persona:** Lucía, 26, trains 4 days a week with her coach Martín. She currently receives her training plan as an Excel file on WhatsApp every Monday. She screenshots the relevant tab and uses that during training, but she can never find her old logs or remember her PRs.

**Opening Scene:** Lucía gets a WhatsApp message from Martín: "Descargá la app, acá está tu invitación" with a link. She taps it, creates an account in seconds, and is automatically linked to Martín's organization.

**Rising Action:** She opens the app and sees today's workout: "Day A — Upper Body." Each exercise is listed with the prescribed sets, reps, and intensity already filled in from her coach's plan. She starts training. After each set, she confirms what she did — the prescription is pre-loaded, so she only needs to adjust if something was different (less reps, more weight, couldn't complete). Optionally, she can rate the effort of each set with RPE or a perceived difficulty scale, giving her coach data on how hard the session felt — but it's not required.

**Climax:** After finishing her session, she checks her history and sees that today she hit a new PR on bench press — 52.5kg × 6, up from last month's 50kg × 6. The app surfaces it automatically. She didn't have to dig through old spreadsheets to know.

**Resolution:** Lucía no longer screenshots Excel tabs. She has her full training history in one place, can see her progress, and her coach can see that she completed the session — all without a WhatsApp back-and-forth.

**Capabilities revealed:** Athlete invitation flow, account creation via invite link, view assigned program/daily workout, workout logging with pre-loaded prescriptions, optional RPE/effort tracking, automatic PR detection, training history.

### Journey 3: Coach Logs a Workout on Behalf of an Athlete

**Persona:** Martín again. One of his athletes, Diego (45, trains at a local gym with no phone during sessions — old school), doesn't use the app. Martín still needs to track Diego's progress.

**Opening Scene:** Diego finishes his session and sends Martín a quick voice note: "Hice 4x8 en sentadilla con 100kg, el press de banca 4x6 con 70, y el resto todo como estaba."

**Rising Action:** Martín opens the coach web app, navigates to Diego's profile, selects today's session, and logs the workout on his behalf. The interface is the same workout logging view, but accessed from the coach side.

**Climax:** Diego's data is now in the system alongside all other athletes. When Martín opens the dashboard, Diego shows as "session completed" just like everyone else. Martín can track Diego's progression and make programming decisions with real data, even though Diego never touches the app.

**Resolution:** No athlete is left behind. Whether they use the PWA or not, the coach can maintain complete records for everyone.

**Capabilities revealed:** Coach-side workout logging, athlete profile → session selection, unified dashboard view regardless of who logged the workout.

### Journey 4: Organization Owner Sets Up the Platform

**Persona:** Sofía, 38, owns a small strength training studio with 3 coaches and 40 athletes. She wants to professionalize her operation and give her team a unified tool.

**Opening Scene:** Sofía signs up, creates her organization "Fuerza Studio", and lands on an empty dashboard. She needs to set up her team before anything else.

**Rising Action:** She goes to Settings, generates invitation links for her 3 coaches and shares them directly (WhatsApp, etc.). They each open the link, create accounts, and join the organization with the appropriate role. Sofía creates athlete profiles. She checks the membership/payment status view to see which athletes have paid this month.

**Climax:** Within a day, all 3 coaches are using the platform, each managing their own athletes' programs. Sofía can see everything from her dashboard — total athletes, active programs, session completion rates, payment status — without asking each coach for updates.

**Resolution:** Sofía went from managing her studio via WhatsApp groups and shared Google Sheets to having a centralized platform where she can oversee operations and her coaches can work independently. When an athlete asks "which gym app do you use?", she can proudly say "our own."

**Capabilities revealed:** Organization setup, coach invitation via shareable link and role assignment, settings page, membership/payment tracking, owner-level dashboard overview.

### Journey 5: New Owner Onboarding and Plan Selection

**Persona:** Martín again — but this time it's his first day. He's heard about Strenly from a colleague and wants to try it for his coaching practice.

**Opening Scene:** Martín signs up with his email and password. Instead of landing on an empty dashboard, the app starts an onboarding flow.

**Rising Action:** The first step asks him to choose a subscription plan. He sees the available tiers with their limits and features — number of athletes, programs, team members. He picks the plan that fits his current practice size. He enters payment details (mock payment for now — the real integration comes later). The next step asks him to create his organization — name and a URL-friendly slug.

**Climax:** Onboarding complete. Martín lands on his dashboard, ready to invite athletes and start building programs. The platform guided him from zero to operational in under two minutes.

**Resolution:** The onboarding funnel ensures every new user has a plan, an organization, and clear next steps — no confusion about what to do first.

**Capabilities revealed:** Account creation, plan selection and subscription, payment processing (mock), organization creation, onboarding flow, redirect to dashboard.

### Journey → Capability Traceability

| Capability Area | Journeys |
|----------------|----------|
| Program grid editor (keyboard-first, Excel-like) | J1 |
| Exercise search and inline selection | J1 |
| Week/session duplication | J1 |
| Program templates (save and create from template) | J1 |
| Program-to-athlete assignment | J1 |
| Dashboard (athlete activity, program status, key stats) | J1, J3, J4 |
| Athlete invitation and account creation | J2, J4 |
| Athlete PWA: view daily workout with pre-loaded prescriptions | J2 |
| Workout logging (athlete-side, confirm/adjust prescription) | J2 |
| Optional RPE/effort tracking per set | J2 |
| Workout logging (coach-side, on behalf of athlete) | J3 |
| PR detection and training history | J2 |
| Organization setup and settings | J4 |
| Coach invitation via shareable link and role management | J4 |
| Membership/payment status tracking | J4 |
| Role-based access (hierarchical: owner > admin > coach > athlete) | J4 |
| Onboarding flow (plan selection, organization creation) | J5 |
| Subscription plan selection and payment | J5 |
| Program list (search, filter, pagination) | J1 |
| User profile management | J1, J2, J3, J4, J5 |

## SaaS B2B Technical Requirements

### Multi-Tenancy

Every tenant-scoped resource belongs to exactly one organization. No query returns data from another organization. Application-level filtering is the primary guard; database-level policies provide a safety net.

### Role-Based Access Control (RBAC)

#### Current Permission Matrix (Owner / Admin / Member)

| Permission | Owner | Admin | Member |
|---|---|---|---|
| organization:read | yes | yes | yes |
| organization:manage | yes | yes | no |
| organization:delete | yes | no | no |
| members:read | yes | yes | yes |
| members:invite | yes | yes | no |
| members:remove | yes | yes | no |
| members:update-role | yes | no | no |
| billing:read | yes | yes | no |
| billing:manage | yes | no | no |
| athletes:read | yes | yes | yes |
| athletes:write | yes | yes | no |
| athletes:delete | yes | yes | no |
| programs:read | yes | yes | yes |
| programs:write | yes | yes | no |
| programs:delete | yes | yes | no |
| exercises:read | yes | yes | yes |
| exercises:write | yes | yes | no |
| workout_log:create | yes | yes | no |
| workout_log:read | yes | yes | yes |
| workout_log:update | yes | yes | no |
| workout_log:delete | yes | yes | no |

#### Phase 1 RBAC Audit

The current model defines permissions per role independently (flat lists). Phase 1 audits two structural decisions:

1. **Role differentiation:** The generic "Member" role must split into Coach and Athlete with distinct permissions — Coach needs write access to programs/athletes/exercises while Athlete needs only read access to their own data plus workout logging.
2. **Inheritance strategy:** Decide between hierarchical inheritance (each role inherits all permissions of the role below it) or multi-role assignment (a user can hold multiple roles). The current flat-list approach duplicates permissions across roles.

### Subscription & Billing

#### Plan Model (Implemented)

Each organization subscribes to a plan. Plans are scoped by organization type and define limits and feature flags:

| Dimension | Description |
|---|---|
| Organization type | `coach_solo` (independent coach) or `gym` (multi-coach studio) |
| Athlete limit | Max athletes per organization (number, or unlimited) |
| Coach limit | Max coaches per organization (number, null = unlimited) |
| Feature flags | templates, analytics, exportData, customExercises, multipleCoaches |
| Pricing | Monthly and yearly (in cents), yearly cannot exceed 12× monthly |

#### Tier Definitions (Phase 4)

Specific plans (names, prices, limits per tier) are defined during Phase 4 when payment integration is implemented. The plan model and enforcement infrastructure are already in place — Phase 4 seeds the actual tier data and connects payment processing.

### External Integrations

MVP external dependency: payment provider (Phase 4). Authentication supports email/password and Google OAuth. Future candidates: Google Calendar, notification services, messaging platforms.

### Constraints

- Athlete invitation is link-based (no email service for MVP)
- One organization per athlete for MVP — multi-gym support deferred to post-MVP
- Offline support not required for Coach Web; evaluate for Athlete PWA post-MVP

## Functional Requirements

### Program Management

- FR1: Coach can create a new training program with a name, description, and optional athlete assignment
- FR2: Coach can edit a program's metadata (name, description, assigned athlete)
- FR3: Coach can archive a program
- FR4: Coach can duplicate an existing program
- FR5: Coach can add, rename, reorder, and delete weeks within a program
- FR6: Coach can add, rename, reorder, and delete sessions within a program
- FR7: Coach can add, reorder, and remove exercise rows within a session
- FR8: Coach can search and select exercises from the exercise library when adding an exercise row
- FR9: Coach can edit prescriptions (sets, reps, intensity, tempo, rest) per exercise per week in a grid interface
- FR10: Coach can navigate the program grid using keyboard (arrow keys, tab, enter, inline editing)
- FR11: Coach can duplicate a week with all its prescriptions
- FR12: Coach can group exercises (supersets) within a session
- FR13: Coach can save a program as a reusable template
- FR14: Coach can create a new program from an existing template
- FR15: Coach can view a list of all programs with search, filtering by status, and pagination

### Exercise Library

- FR16: Coach can view the full exercise library (curated + custom) with search, filters by muscle group and movement pattern
- FR17: Coach can create custom exercises with name, description, instructions, video URL, movement pattern, and muscle groups
- FR18: Coach can edit and archive custom exercises
<!-- FR19: intentional gap — reserved -->

### Athlete Management

- FR20: Coach can create, edit, and archive athlete profiles (name, email, phone, birthdate, gender, notes)
- FR21: Coach can view a list of all athletes with search, status filter, and pagination
- FR22: Coach can generate an invitation link for an athlete
- FR23: Coach can view the status of an athlete's invitation (pending, accepted, expired)
- FR24: Coach can assign a program to an athlete

### Workout Logging

- FR25: Coach can create and record a workout log on behalf of an athlete for a specific session and week
- FR26: Coach can view an athlete's workout log history
- FR27: Athlete can view their assigned workout for a given session with prescriptions pre-loaded
- FR28: Athlete can log a workout by confirming or adjusting the pre-loaded prescription values (sets, reps, weight)
- FR29: Athlete can optionally record RPE or perceived effort per set
- FR30: Athlete can view their workout log history
- FR31: Athlete can view automatically detected personal records (PRs)

### Dashboard & Analytics

- FR32: Coach can view a dashboard with athlete activity overview (who trained, who didn't, active programs)
- FR33: Coach can view program counts by status (draft, active, archived) on the dashboard
- FR34: Coach can view athlete membership and payment status

### Organization & Team Management

- FR35: Owner can create an organization with name and slug
- FR36: Admin can generate invitation links for coaches with role assignment
- FR37: Admin can view and manage team members (coaches) and their roles
- FR38: Owner can remove team members from the organization
- FR39: Admin can access organization settings (name, configuration)

### User Profile

- FR55: User can view and edit their profile (name, avatar)

### Authentication & Authorization

- FR40: User can sign up with email/password or Google OAuth
- FR41: User can sign in and maintain a session
- FR42: User can sign out
- FR56: New user is guided through an onboarding flow after sign-up: plan selection, payment, and organization creation
- FR43: System enforces role-based access control (Owner > Admin > Coach > Athlete) on all actions
- FR44: System restricts data access to the user's organization (multi-tenant isolation)

### Athlete App (PWA)

- FR45: Athlete can accept an invitation link to create an account and join an organization
- FR46: Athlete can view their assigned training programs
- FR47: Athlete can view the workout for a specific day/session with pre-loaded prescriptions
- FR48: Athlete can browse their training history with progress visualization
- FR49: Athlete can view their personal records (PRs) across exercises

### Subscription & Billing

- FR50: Owner can view available subscription plans with features and limits
- FR51: Owner can subscribe to a plan
- FR52: System enforces plan limits (max athletes, max coaches) when creating athlete profiles, inviting coaches, and assigning programs, blocking the action with a clear upgrade prompt when limits are reached
- FR53: Coach can view athlete payment/membership status
- FR54: Owner can complete a payment transaction to activate a subscription plan

## Non-Functional Requirements

### Performance

| Requirement | Metric | Verification |
|---|---|---|
| Grid keyboard responsiveness | Keyboard navigation (arrow keys, tab, enter) responds within 50ms | Playwright timing assertion: measure keydown → cell render delta |
| Grid rendering at scale | Programs up to 8 weeks × 6 sessions render at ≥60fps during keyboard navigation | Chrome DevTools Performance panel during Phase 2 testing |
| API response time | Standard CRUD operations complete within 500ms | Integration test with timing assertion on endpoints |
| Program aggregate load | Full nested hierarchy loads within 1 second | Integration test with timing assertion on program load endpoint |
| PWA initial load | Under 3 seconds on a 4G mobile connection | Lighthouse CI with Slow 4G throttling preset (Phase 3) |
| Workout logging interactions | Confirm set, adjust values respond within 200ms | Playwright timing assertion (Phase 2 coach-side, Phase 3 athlete-side) |

### Security

| Requirement | Metric | Verification |
|---|---|---|
| Encryption in transit | All data served over HTTPS | Deployment configuration validation |
| Session token protection | Tokens inaccessible to client-side scripts | Integration test: verify HttpOnly + Secure flags on Set-Cookie header |
| Multi-tenant isolation | No query returns data from another organization | Integration test: create data in org A, query from org B context, assert empty |
| Password storage | Passwords stored using industry-standard one-way hashing | Smoke test: verify stored password differs from plaintext input |
| Invitation token security | Tokens are single-use, time-limited, and cryptographically random | Unit test: use token then reuse (assert fail), test with expired token (assert fail) |
| No sensitive data exposure | No passwords or tokens in API responses or client logs | Integration test: scan API response bodies for sensitive field patterns |

### Reliability

| Requirement | Metric | Verification |
|---|---|---|
| Program draft persistence | Explicit save persists all program data without loss | E2E test: save draft, reload page, verify data persists |
| Workout log persistence | Workout log data persists immediately on save | E2E test: log workout, reload, verify data (Phase 2/3) |
| Graceful error handling | Network failures show error UI, not blank screens or crashes | E2E test: mock network failure via page.route, verify error message renders |
