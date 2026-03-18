---
name: architecture
description: |
  Defines the mandatory Clean Architecture development flow for the project.
  Use this skill DURING PLANNING (before creating any plan) and BEFORE implementing any backend feature.
  Plans that don't include domain entities and ports for new concepts are INCOMPLETE.
  This skill should be loaded automatically when planning or implementing backend features.
---

<objective>
Defines the mandatory inside-out development flow for backend features in Clean Architecture. Start from the core (domain) and work outward to the API layer. Ensures authorization, domain validation, and proper layer separation.
</objective>

<quick_start>
For ANY backend feature, follow this order and invoke the corresponding skill:

1. **Domain** (`/domain`) → `src/core/domain/entities/`
2. **Port** (`/port`) → `src/core/ports/`
3. **Repository** (`/repository`) → `src/server/repositories/`
4. **Use Case** (`/use-case` + `/authorization`) → `src/server/use-cases/`
5. **Contracts** (`/contracts`) → `src/contracts/`
6. **Procedure** (`/procedure`) → `src/server/procedures/`
</quick_start>

<critical_context>
**When to load this skill:**
1. **During `/gsd:plan-phase`** — Before creating any plan for backend work
2. **During `/gsd:execute-phase`** — Before implementing any task

**A plan is INCOMPLETE if it:**
- Introduces a new domain concept (e.g., subscription, athlete) without domain entity tasks
- Creates use cases without corresponding port/repository tasks
- Has procedures without domain entity validation

**Without following this flow:**
- Authorization gets skipped (security vulnerability)
- Data gets persisted without domain validation (data integrity issues)
- Business logic ends up in procedures (unmaintainable code)
- Pagination breaks (missing totalCount for DataTable)
</critical_context>

<development_flow>
```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. DOMAIN (/domain)                                                  │
│    Location: src/core/domain/entities/{entity}.ts                   │
│    - Factory function returns Result<Entity, DomainError>           │
│    - All business validation rules live here                        │
│    - ID is received as input (not generated here)                   │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. PORT (/port)                                                     │
│    Location: src/core/ports/{entity}-repository.port.ts             │
│    - Define repository interface                                    │
│    - All methods receive OrganizationContext                        │
│    - findAll returns { items, totalCount } (REQUIRED for pagination)│
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. REPOSITORY (/repository)                                         │
│    Location: src/server/repositories/                               │
│    - Implement port with Drizzle ORM                                │
│    - ALWAYS filter by ctx.organizationId (multi-tenancy)            │
│    - Use ResultAsync.fromPromise with wrapError                     │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. USE CASE (/use-case + /authorization)                            │
│    Location: src/server/use-cases/{domain}/                         │
│    - Authorization check FIRST (hasPermission)                      │
│    - Validate via domain entity BEFORE persisting                   │
│    - generateId as injected dependency                              │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. CONTRACTS (/contracts)                                           │
│    Location: src/contracts/{domain}/                                │
│    - Zod schemas for API input/output                               │
│    - Validation messages in Spanish                                 │
│    - List endpoints: limit, offset input + totalCount output        │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. PROCEDURE (/procedure)                                           │
│    Location: src/server/procedures/{domain}/                        │
│    - ONLY orchestration (create repos, use case, map errors)        │
│    - NO business logic here                                         │
│    - Map ALL error types with exhaustive switch                     │
└─────────────────────────────────────────────────────────────────────┘
```
</development_flow>

<common_violations>
**1. Authorization Must Be FIRST in Use Cases**

```typescript
// WRONG - No authorization
export const makeCreateAthlete = (deps) => (input) => {
  return deps.repository.create(ctx, input)
}

// CORRECT - Authorization FIRST
export const makeCreateAthlete = (deps) => (input) => {
  if (!hasPermission(input.memberRole, 'athletes:write')) {
    return errAsync({ type: 'forbidden', message: '...' })
  }
  // ... rest of logic
}
```

**2. Domain Entity Validation Before Persisting**

```typescript
// WRONG - Persist without domain validation
const id = deps.generateId()
return deps.repository.create(ctx, { id, ...input })

// CORRECT - Validate via domain first
const entityResult = createAthlete({ id: deps.generateId(), ...input })
if (entityResult.isErr()) {
  return errAsync({ type: 'validation_error', message: entityResult.error.message })
}
return deps.repository.create(ctx, entityResult.value)
```

**3. No Business Logic in Procedures**

```typescript
// WRONG - Logic in procedure
.handler(async ({ input }) => {
  if (input.amount > 1000) {  // Business rule in procedure!
    throw errors.LIMIT_EXCEEDED()
  }
})

// CORRECT - Procedure only orchestrates
.handler(async ({ input, context }) => {
  const result = await useCase(input)
  if (result.isErr()) {
    switch (result.error.type) { /* map errors */ }
  }
  return result.value
})
```

**4. Always Return totalCount in Lists**

```typescript
// WRONG - Only return items
findAll: (ctx, options) => {
  return db.select().from(table).limit(options.limit)
}

// CORRECT - Return items + totalCount
findAll: (ctx, options) => {
  const [{ count }] = await db.select({ count: count() }).from(table)
  const items = await db.select().from(table).limit(options.limit)
  return { items, totalCount: count }
}
```

**5. Always Filter by OrganizationContext**

```typescript
// WRONG - No organization filter
findById: (id) => {
  return db.select().from(table).where(eq(table.id, id))
}

// CORRECT - Always filter by organizationId
findById: (ctx, id) => {
  return db.select().from(table).where(
    and(
      eq(table.id, id),
      eq(table.organizationId, ctx.organizationId)
    )
  )
}
```
</common_violations>

<layer_reference>
| What | Layer | Skill |
|------|-------|-------|
| Business validation rules | Domain | `/domain` |
| Repository interfaces | Port | `/port` |
| Database queries (Drizzle) | Repository | `/repository` |
| Business logic orchestration | Use Case | `/use-case` |
| Permission checks (RBAC) | Use Case | `/authorization` |
| API input/output schemas | Contracts | `/contracts` |
| API endpoints | Procedure | `/procedure` |
</layer_reference>

<planning_checklist>
For each new domain concept introduced by a phase, the plan MUST include tasks for:

- [ ] **Domain** task — `src/core/domain/entities/{entity}.ts` — skill: `/domain`
- [ ] **Domain Entity Tests** task — `src/core/domain/entities/{entity}.test.ts` (90%+ coverage required)
- [ ] **Port** task — `src/core/ports/{entity}-repository.port.ts` — skill: `/port`
- [ ] **Repository** task — `src/server/repositories/{entity}.repository.ts` — skill: `/repository`
- [ ] **Use Case** tasks — authorization-first, domain validation — skills: `/use-case`, `/authorization`
- [ ] **Contracts** task — Zod schemas for API — skill: `/contracts`
- [ ] **Procedure** task — thin API handler — skill: `/procedure`

**Each task MUST specify which skill to load.** Example:

```markdown
<task type="auto">
  <name>Create Athlete Domain Entity</name>
  <skills>/domain</skills>
  <files>src/core/domain/entities/athlete.ts</files>
  <action>...</action>
</task>
```
</planning_checklist>

<success_criteria>
- [ ] Domain entity created with factory function returning Result
- [ ] Domain entity has comprehensive tests (90%+ coverage on `src/core`)
- [ ] Port defined with OrganizationContext and pagination types
- [ ] Repository filters by organizationId, returns totalCount for lists
- [ ] Use case checks authorization FIRST, validates via domain entity
- [ ] Contracts have validation messages in Spanish
- [ ] Procedure only orchestrates, maps ALL error types
</success_criteria>

<skill_reference>
| Layer | Skill | When Required |
|-------|-------|---------------|
| Domain | `/domain` | Creating entities, value objects, and aggregates |
| Domain | `/port` | Defining repository interfaces |
| Infrastructure | `/repository` | Implementing ports with Drizzle |
| Application | `/use-case` | Business logic orchestration |
| Application | `/authorization` | Permission checks in use cases |
| API | `/contracts` | Zod schemas for input/output |
| API | `/procedure` | Thin API handlers |
| Frontend | `/orpc-query` | Query/mutation hooks |
| Frontend | `/mutation-errors` | Error handling in mutations |
| Frontend | `/form` | Forms with React Hook Form |
| Frontend | `/data-table` | Tables with pagination |
| Validation | `/test-runner` | Before committing code |
</skill_reference>

<domain_concepts>
| Concept | Domain Entity | Port | Repository |
|---------|---------------|------|------------|
| Subscription | `subscription.ts` | `subscription-repository.port.ts` | `subscription.repository.ts` |
| Plan (subscription tier) | `plan.ts` | `plan-repository.port.ts` | `plan.repository.ts` |
| Athlete | `athlete.ts` | `athlete-repository.port.ts` | `athlete.repository.ts` |
| Exercise | `exercise.ts` | `exercise-repository.port.ts` | `exercise.repository.ts` |
| Program | `program.ts` | `program-repository.port.ts` | `program.repository.ts` |
| Session | `session.ts` | `session-repository.port.ts` | `session.repository.ts` |
| Workout Log | `workout-log.ts` | `workout-log-repository.port.ts` | `workout-log.repository.ts` |
</domain_concepts>

<resources>
For complete code examples of each layer, see `references/layer-examples.md`.
</resources>
