---
name: clean-architecture
description: >-
  Inside-out Clean Architecture flow for backend features: Domain → Port → Repository →
  Use Case → Contracts → Procedure. Use this skill when planning or implementing any backend
  feature that introduces domain concepts, use cases, repositories, or API endpoints — even
  if the user doesn't say "clean architecture". Also use when reviewing backend code for
  architectural violations or structuring a new feature.
scope: ["clean-architecture"]
---

# Clean Architecture

Defines the mandatory inside-out development flow for backend features in Clean Architecture. Start from the core (domain) and work outward to the API layer. Ensures authorization, domain validation, and proper layer separation.

## Quick Start

For ANY backend feature, follow this order:

1. **Domain** (`/domain`) → `{core}/domain/entities/`
2. **Port** (`/port`) → `{core}/ports/`
3. **Repository** (`/repository`) → `{infra}/repositories/`
4. **Use Case** (`/use-case` + `/authorization`) → `{app}/use-cases/`
5. **Contracts** (`/contracts`) → `{contracts}/`
6. **Procedure** (`/procedure`) → `{api}/procedures/`

## Critical Context

**When to load this skill:**
1. **During planning** — Before creating any plan for backend work
2. **During implementation** — Before implementing any backend feature task

**A plan is INCOMPLETE if it:**
- Introduces a new domain concept without a domain entity task (factory function + validation)
- Creates use cases without corresponding port and repository tasks
- Has procedure/endpoint tasks without domain entity validation
- Skips the contracts layer (no input/output schemas defined)

**Without following this flow:**
- Authorization gets skipped (security vulnerability)
- Data gets persisted without domain validation (data integrity issues)
- Business logic ends up in procedures (unmaintainable code)

> **Stack:** This skill targets neverthrow + Drizzle + oRPC + Zod. Projects adapt by mapping path placeholders (`{core}`, `{infra}`, etc.) to their directory structure in CLAUDE.md.

## Development Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. DOMAIN                                                           │
│    Location: {core}/domain/entities/{entity}.ts                     │
│    - Factory function returns Result<Entity, DomainError>           │
│    - All business validation rules live here                        │
│    - ID is received as input (not generated here)                   │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 2. PORT                                                             │
│    Location: {core}/ports/{entity}-repository.port.ts               │
│    - Define repository interface                                    │
│    - All methods receive Context (project defines what it contains) │
│    - List operations return { items, totalCount }                   │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 3. REPOSITORY                                                       │
│    Location: {infra}/repositories/                                  │
│    - Implement port with Drizzle ORM                                │
│    - ALWAYS filter by context (tenant isolation, soft deletes, etc.)│
│    - Use ResultAsync.fromPromise() with wrapError                   │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 4. USE CASE                                                         │
│    Location: {app}/use-cases/{domain}/                              │
│    - Authorization check FIRST                                      │
│    - Validate via domain entity BEFORE persisting                   │
│    - generateId as injected dependency                              │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 5. CONTRACTS                                                        │
│    Location: {contracts}/{domain}/                                  │
│    - Zod schemas for API input/output                               │
│    - Validation messages in project's language                      │
│    - List endpoints: limit, offset input + totalCount output        │
└─────────────────────────────────────────────────────────────────────┘
                                 ↓
┌─────────────────────────────────────────────────────────────────────┐
│ 6. PROCEDURE                                                        │
│    Location: {api}/procedures/{domain}/                             │
│    - ONLY orchestration (create repos, use case, map errors)        │
│    - NO business logic here                                         │
│    - Map ALL error types with exhaustive switch                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Common Violations

**1. Authorization Must Be FIRST in Use Cases**

```typescript
// WRONG - No authorization
export const makeCreateEntity = (deps) => (input) => {
  return deps.repository.create(ctx, input)
}

// CORRECT - Authorization FIRST
export const makeCreateEntity = (deps) => (input) => {
  if (!hasPermission(input.memberRole, 'entities:write')) {
    return errAsync({ type: 'forbidden', message: 'Insufficient permissions' })
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
const entityResult = createEntity({ id: deps.generateId(), ...input })
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
.handler(async ({ input, context, errors }) => {
  const result = await useCase(input)
  if (result.isErr()) {
    switch (result.error.type) {
      case 'forbidden': throw errors.FORBIDDEN()
      case 'validation_error': throw errors.VALIDATION_ERROR({ message: result.error.message })
      // ... map ALL error types
    }
  }
  return result.value
})
```

**4. Update Use Cases Must Re-validate Through Domain**

```typescript
// WRONG - Update bypasses domain validation
export const makeUpdateEntity = (deps) => (input) => {
  return deps.repository.update(ctx, input.id, input.changes)
}

// CORRECT - Fetch existing, apply changes, re-validate via domain factory
export const makeUpdateEntity = (deps) => (input) => {
  return deps.repository.findById(ctx, input.id)
    .andThen((existing) => {
      const entityResult = createEntity({ ...existing, ...input.changes })
      if (entityResult.isErr()) {
        return errAsync({ type: 'validation_error', message: entityResult.error.message })
      }
      return deps.repository.update(ctx, input.id, entityResult.value)
    })
}
```

**5. Always Return totalCount in Lists**

```typescript
// WRONG - Only return items
findAll: async (ctx, options) => {
  const items = await repository.list(ctx, options)
  return { ok: true, value: items }
}

// CORRECT - Return items + totalCount
findAll: async (ctx, options) => {
  const { items, totalCount } = await repository.findAll(ctx, options)
  return { ok: true, value: { items, totalCount } }
}
```

**6. Always Pass Context for Tenant Isolation**

```typescript
// WRONG - No context filtering
findById: (id) =>
  ResultAsync.fromPromise(
    db.select().from(table).where(eq(table.id, id)),
    wrapError('findById'),
  )

// CORRECT - Always filter by context
findById: (ctx, id) =>
  ResultAsync.fromPromise(
    db.select().from(table).where(
      and(eq(table.id, id), eq(table.organizationId, ctx.organizationId))
    ),
    wrapError('findById'),
  )
```

## Layer Reference

| What | Layer | Skill |
|------|-------|-------|
| Business validation rules | Domain | `/domain` |
| Repository interfaces | Port | `/port` |
| Database queries (Drizzle) | Repository | `/repository` |
| Business logic orchestration | Use Case | `/use-case` |
| Permission checks (RBAC) | Use Case | `/authorization` |
| API input/output schemas (Zod) | Contracts | `/contracts` |
| API endpoints (oRPC) | Procedure | `/procedure` |

## Planning Checklist

For each new domain concept introduced, the plan MUST include tasks for:

- [ ] **Domain** — `{core}/domain/entities/{entity}.ts` — factory function returning Result — skill: `/domain`
- [ ] **Domain Tests** — `{core}/domain/entities/{entity}.test.ts` — comprehensive validation coverage
- [ ] **Port** — `{core}/ports/{entity}-repository.port.ts` — repository interface with Context — skill: `/port`
- [ ] **Repository** — `{infra}/repositories/{entity}.repository.ts` — Drizzle implementation with context filtering — skill: `/repository`
- [ ] **Use Case** — `{app}/use-cases/{domain}/` — authorization-first, domain validation before persist — skills: `/use-case`, `/authorization`
- [ ] **Contracts** — `{contracts}/{domain}/` — Zod schemas for API — skill: `/contracts`
- [ ] **Procedure** — `{api}/procedures/{domain}/` — thin oRPC orchestration layer — skill: `/procedure`

## Success Criteria

- [ ] Domain entity created with factory function returning Result
- [ ] Domain entity has comprehensive tests (project determines coverage threshold)
- [ ] Port defined with Context parameter and pagination types
- [ ] Repository filters by context, returns totalCount for lists
- [ ] Use case checks authorization FIRST, validates via domain entity
- [ ] Contracts have Zod validation messages in project's language
- [ ] Procedure only orchestrates, maps ALL error types via exhaustive switch

## Extensibility

This skill defines the **core architectural flow** with a concrete stack: **neverthrow** for Result types, **Drizzle** for ORM, **oRPC** for procedures, and **Zod** for contracts. The core flow and layer responsibilities remain the same across all projects.

**How to adapt per project:**
- **Path mapping**: Map the placeholders (`{core}/`, `{infra}/`, `{app}/`, `{contracts}/`, `{api}/`) to your project's actual directory structure in CLAUDE.md. Works for both monorepos and single-repo layouts.
- **Context definition**: Define what `Context` contains for your project (e.g., `{ organizationId, memberId, role }` for multi-tenant apps, `{ userId }` for single-tenant).
- **Additional references**: Add project-specific reference files alongside `references/layer-examples.md` with code samples using your exact import paths and domain entities.

## Resources

When implementing a specific layer, read `references/layer-examples.md` for complete code examples. The file has a table of contents — jump to the relevant section rather than reading the entire file.
