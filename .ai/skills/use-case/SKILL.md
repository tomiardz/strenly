---
name: use-case
description: >-
  Application-layer use cases with authorization-first, domain validation, and neverthrow.
  Use this skill when implementing business logic, orchestrating repositories, checking
  permissions, validating via domain entities, or coordinating multi-step operations.
  Also use when reviewing use case code for missing authorization, bypassed domain validation,
  or incorrect error handling. Triggers on: application layer, use case, business logic,
  orchestration, authorization-first, make{Action} factory functions, ResultAsync chaining.
  Do NOT load for domain entity definitions (use /domain),
  repository implementations (use /repository), or API endpoint handlers (use /procedure).
scope: ["clean-architecture"]
---

# Use Case

Creates use cases that orchestrate business logic in the application layer. Use cases check authorization FIRST, validate via domain entities, and coordinate repository operations. All use cases return `ResultAsync<Output, Error>` via neverthrow — never throw.

> **Stack:** neverthrow for Result types. Projects map path placeholders (`{app}`, `{core}`, etc.) to their directory structure in CLAUDE.md.

## Location

```
{app}/use-cases/
├── {domain}/
│   ├── create-{entity}.ts
│   ├── update-{entity}.ts
│   ├── delete-{entity}.ts
│   ├── list-{entities}.ts
│   └── {custom-action}.ts
```

## Quick Start

1. Create file at `{app}/use-cases/{domain}/{action}.ts`
2. Export `Input`, `Output`, and `Error` types
3. Define `Dependencies` type with `generateId: () => string` (for create operations)
4. Authorization check **FIRST** (before any logic)
5. Validate via domain entity **BEFORE** persisting
6. Return `ResultAsync<Output, Error>`

## Critical Context

**Every use case that creates or modifies data MUST use domain entities for validation.**

Domain entities (`{core}/domain/entities/`) are the source of truth for business rules. Without them, data gets persisted without business rule validation.

The flow is always:

1. Authorization check
2. Business rules validation (duplicates, limits, constraints)
3. **Create/validate entity via domain** — validates all business rules
4. Persist via repository

## Factory Pattern

Every use case is a curried factory: outer function receives dependencies, inner function receives input:

```typescript
import { hasPermission, type Role } from '{core}/services/authorization'
import { create{Entity} } from '{core}/domain/entities/{entity}'
import type { {Entity}RepositoryPort } from '{core}/ports/{entity}-repository.port'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

// 1. Input type (exported)
export type Create{Entity}Input = {
  organizationId: string
  memberId: string
  memberRoles: Role[]
  {entity}: {
    name: string
    // ... fields from contracts
  }
}

// 2. Output type (exported)
export type Create{Entity}Output = {Entity}

// 3. Error type (exported, discriminated union)
export type Create{Entity}Error =
  | { type: 'forbidden'; message: string }
  | { type: 'validation_error'; message: string }
  | { type: 'duplicate_name'; message: string }
  | { type: 'repository_error'; cause: unknown }

// 4. Dependencies type (internal)
type Dependencies = {
  {entity}Repository: {Entity}RepositoryPort
  generateId: () => string
}

// 5. Factory function
export const makeCreate{Entity} =
  (deps: Dependencies) =>
  (input: Create{Entity}Input): ResultAsync<Create{Entity}Output, Create{Entity}Error> => {
    // 1. Authorization check FIRST
    if (!hasPermission(input.memberRoles, '{entities}:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'Insufficient permissions',
      })
    }

    const ctx = { organizationId: input.organizationId }

    // 2. Check business rules (duplicates, limits, etc.)
    return deps.{entity}Repository
      .existsByName(ctx, input.{entity}.name)
      .mapErr((e): Create{Entity}Error => ({ type: 'repository_error', cause: e }))
      .andThen((exists) => {
        if (exists) {
          return errAsync<Create{Entity}Output, Create{Entity}Error>({
            type: 'duplicate_name',
            message: 'A {entity} with this name already exists',
          })
        }

        // 3. Create entity via domain (validates business rules)
        const entityResult = create{Entity}({
          id: deps.generateId(),
          organizationId: input.organizationId,
          name: input.{entity}.name,
        })

        if (entityResult.isErr()) {
          return errAsync<Create{Entity}Output, Create{Entity}Error>({
            type: 'validation_error',
            message: entityResult.error.message,
          })
        }

        // 4. Persist via repository
        return deps.{entity}Repository
          .create(ctx, entityResult.value)
          .mapErr((e): Create{Entity}Error => ({ type: 'repository_error', cause: e }))
      })
  }
```

## File Structure

Every use case file follows this order:

```
1. Imports
2. Input type (exported)
3. Output type (exported)
4. Error type (exported, discriminated union)
5. Dependencies type (internal)
6. Factory function (exported)
```

## Use Case Variants

### Create

See the full factory pattern above. Key points:

- `generateId` in Dependencies — IDs are injected, never generated in the use case
- Domain entity validates all fields before persist
- Check for duplicates or limits before creating

### Update (Merge Strategy)

Fetch the existing entity, merge changes, re-validate through the domain factory:

```typescript
export type Update{Entity}Input = {
  organizationId: string
  memberId: string
  memberRoles: Role[]
  {entity}Id: string
  data: {
    name?: string
    description?: string | null
  }
}

export type Update{Entity}Output = {Entity}

export type Update{Entity}Error =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; message: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; cause: unknown }

export const makeUpdate{Entity} =
  (deps: Dependencies) =>
  (input: Update{Entity}Input): ResultAsync<Update{Entity}Output, Update{Entity}Error> => {
    if (!hasPermission(input.memberRoles, '{entities}:write')) {
      return errAsync({ type: 'forbidden', message: 'Insufficient permissions' })
    }

    const ctx = { organizationId: input.organizationId }

    return deps.{entity}Repository
      .findById(ctx, input.{entity}Id)
      .mapErr((e): Update{Entity}Error => ({ type: 'repository_error', cause: e }))
      .andThen((existing) => {
        if (!existing) {
          return errAsync<Update{Entity}Output, Update{Entity}Error>({
            type: 'not_found',
            message: '{Entity} not found',
          })
        }

        // Merge input with existing — use ?? to preserve existing values
        // Use explicit null check to allow nullifying optional fields
        const entityResult = create{Entity}({
          ...existing,
          name: input.data.name ?? existing.name,
          description: input.data.description !== undefined
            ? input.data.description
            : existing.description,
        })

        if (entityResult.isErr()) {
          return errAsync<Update{Entity}Output, Update{Entity}Error>({
            type: 'validation_error',
            message: entityResult.error.message,
          })
        }

        return deps.{entity}Repository
          .update(ctx, input.{entity}Id, entityResult.value)
          .mapErr((e): Update{Entity}Error => ({ type: 'repository_error', cause: e }))
          .andThen((updated) => {
            // Guard against concurrent deletion between findById and update
            if (!updated) {
              return errAsync<Update{Entity}Output, Update{Entity}Error>({
                type: 'not_found',
                message: '{Entity} not found',
              })
            }
            return okAsync(updated)
          })
      })
  }
```

**Merge rules:**
- `input.data.field ?? existing.field` — preserve existing when field is not provided
- `input.data.field !== undefined ? input.data.field : existing.field` — allow explicit `null` to clear optional fields
- Always re-validate through domain factory after merge

### Delete / Archive

Delete operations often have constraint checks. Soft deletes (archive) are more common than hard deletes:

```typescript
export type Archive{Entity}Input = {
  organizationId: string
  memberId: string
  memberRoles: Role[]
  {entity}Id: string
}

export type Archive{Entity}Error =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; message: string }
  | { type: 'repository_error'; cause: unknown }

type Dependencies = {
  {entity}Repository: {Entity}RepositoryPort
}

export const makeArchive{Entity} =
  (deps: Dependencies) =>
  (input: Archive{Entity}Input): ResultAsync<void, Archive{Entity}Error> => {
    if (!hasPermission(input.memberRoles, '{entities}:delete')) {
      return errAsync({ type: 'forbidden', message: 'Insufficient permissions' })
    }

    const ctx = { organizationId: input.organizationId }

    return deps.{entity}Repository
      .softDelete(ctx, input.{entity}Id)
      .mapErr((e): Archive{Entity}Error => ({ type: 'repository_error', cause: e }))
  }
```

For hard deletes with constraint validation (e.g., "cannot delete if has dependencies"):

```typescript
return deps.{entity}Repository
  .findById(ctx, input.{entity}Id)
  .mapErr((e): Delete{Entity}Error => ({ type: 'repository_error', cause: e }))
  .andThen((entity) => {
    if (!entity) {
      return errAsync<void, Delete{Entity}Error>({
        type: 'not_found',
        message: '{Entity} not found',
      })
    }

    // Business rule: cannot delete if has active children
    if (entity.activeChildCount > 0) {
      return errAsync<void, Delete{Entity}Error>({
        type: 'validation_error',
        message: 'Cannot delete {entity} with active children',
      })
    }

    return deps.{entity}Repository
      .delete(ctx, input.{entity}Id)
      .mapErr((e): Delete{Entity}Error => ({ type: 'repository_error', cause: e }))
  })
```

### List / Query

List operations are lightweight — no domain validation, just authorization + passthrough to repository:

```typescript
export type List{Entities}Input = {
  organizationId: string
  memberId: string
  memberRoles: Role[]
  search?: string
  status?: string
  limit: number
  offset: number
}

export type List{Entities}Output = {
  items: {Entity}[]
  totalCount: number
}

export type List{Entities}Error =
  | { type: 'forbidden'; message: string }
  | { type: 'repository_error'; cause: unknown }

type Dependencies = {
  {entity}Repository: {Entity}RepositoryPort
}

export const makeList{Entities} =
  (deps: Dependencies) =>
  (input: List{Entities}Input): ResultAsync<List{Entities}Output, List{Entities}Error> => {
    if (!hasPermission(input.memberRoles, '{entities}:read')) {
      return errAsync({ type: 'forbidden', message: 'Insufficient permissions' })
    }

    const ctx = { organizationId: input.organizationId }

    return deps.{entity}Repository
      .findAll(ctx, {
        search: input.search,
        status: input.status,
        limit: input.limit,
        offset: input.offset,
      })
      .mapErr((e): List{Entities}Error => ({ type: 'repository_error', cause: e }))
  }
```

**Key:** List outputs always use `{ items, totalCount }` — never entity-named keys.

## Multi-Step Operations

For complex workflows that chain multiple repository calls, use `.andThen()`:

```typescript
type Dependencies = {
  {entity}Repository: {Entity}RepositoryPort
  relatedRepository: RelatedRepositoryPort
  generateId: () => string
}

export const makeGenerate{Action} =
  (deps: Dependencies) =>
  (input: Generate{Action}Input): ResultAsync<Generate{Action}Output, Generate{Action}Error> => {
    if (!hasPermission(input.memberRoles, '{entities}:write')) {
      return errAsync({ type: 'forbidden', message: 'Insufficient permissions' })
    }

    const ctx = { organizationId: input.organizationId }

    // 1. Fetch the entity
    return deps.{entity}Repository
      .findById(ctx, input.{entity}Id)
      .mapErr((e): Generate{Action}Error => ({ type: 'repository_error', cause: e }))
      .andThen((entity) => {
        if (!entity) {
          return errAsync<Generate{Action}Output, Generate{Action}Error>({
            type: 'not_found',
            message: '{Entity} not found',
          })
        }

        // 2. Validate business state
        if (entity.status !== 'active') {
          return errAsync<Generate{Action}Output, Generate{Action}Error>({
            type: 'validation_error',
            message: '{Entity} must be active',
          })
        }

        // 3. Perform side effect (e.g., revoke old, create new)
        return deps.relatedRepository
          .revokeExisting(ctx, entity.id)
          .mapErr((e): Generate{Action}Error => ({ type: 'repository_error', cause: e }))
          .andThen(() => {
            // 4. Create new related entity
            return deps.relatedRepository
              .create(ctx, {
                id: deps.generateId(),
                {entity}Id: entity.id,
              })
              .mapErr((e): Generate{Action}Error => ({ type: 'repository_error', cause: e }))
          })
      })
  }
```

## Error Handling

### Error Type Union

Every use case defines its own error union as a discriminated union with `type` field:

```typescript
export type {Action}{Entity}Error =
  | { type: 'forbidden'; message: string }        // Authorization failed
  | { type: 'not_found'; message: string }         // Entity doesn't exist
  | { type: 'validation_error'; message: string }  // Domain validation failed
  | { type: 'duplicate_name'; message: string }    // Business rule violation
  | { type: 'repository_error'; cause: unknown }   // Database error
```

**Rules:**
- Include `forbidden` for any use case that checks authorization
- Include `not_found` for operations on existing entities (update, delete, get)
- Include `validation_error` for operations that validate through domain
- Include `repository_error` as a catch-all for database failures
- Add domain-specific errors as needed (e.g., `duplicate_name`, `limit_exceeded`)

### Error Mapping

Map repository errors to use case errors at the boundary:

```typescript
// Inline mapping (most common)
.mapErr((e): {Action}{Entity}Error => ({ type: 'repository_error', cause: e }))

// Extracted mapper (when multiple methods need the same mapping)
function mapRepoError(e: {Entity}RepositoryError): {Action}{Entity}Error {
  if (e.type === 'NOT_FOUND') {
    return { type: 'not_found', message: '{Entity} not found' }
  }
  return { type: 'repository_error', cause: e }
}
```

### Type Annotations on errAsync/okAsync

When TypeScript cannot infer the full union, annotate explicitly:

```typescript
// Needed when returning from inside .andThen() where the chain type is ambiguous
return errAsync<Create{Entity}Output, Create{Entity}Error>({
  type: 'duplicate_name',
  message: 'Name already exists',
})
```

## ID Generation

**Never use external libraries directly in use cases for ID generation.** Inject `generateId` as a dependency:

```typescript
type Dependencies = {
  {entity}Repository: {Entity}RepositoryPort
  generateId: () => string  // Injected, not hardcoded
}
```

This makes use cases testable (mock the generator) and follows dependency inversion. The procedure provides the real implementation (e.g., `nanoid`, `uuid`).

**Only include `generateId` in Dependencies for use cases that create entities.** Update, delete, and list use cases don't need it.

## Context Construction

Construct the context object from input fields before passing to repositories:

```typescript
const ctx = { organizationId: input.organizationId }

return deps.{entity}Repository.findById(ctx, input.{entity}Id)
```

The context shape is project-defined (e.g., `{ organizationId }` for multi-tenant, `{ userId }` for single-tenant). Read the project's existing ports to discover what context fields are required.

## Common Violations

**1. Missing authorization check**

```typescript
// WRONG — No permission check
export const makeCreate{Entity} = (deps) => (input) => {
  return deps.repository.create(ctx, input)
}

// CORRECT — Authorization FIRST
export const makeCreate{Entity} = (deps) => (input) => {
  if (!hasPermission(input.memberRoles, '{entities}:write')) {
    return errAsync({ type: 'forbidden', message: 'Insufficient permissions' })
  }
  // ... rest of logic
}
```

**2. Persisting without domain validation**

```typescript
// WRONG — No domain validation
return deps.repository.create(ctx, {
  id: deps.generateId(),
  name: input.name,
})

// CORRECT — Validate via domain first
const entityResult = create{Entity}({ id: deps.generateId(), ...input })
if (entityResult.isErr()) {
  return errAsync({ type: 'validation_error', message: entityResult.error.message })
}
return deps.repository.create(ctx, entityResult.value)
```

**3. Update bypasses domain re-validation**

```typescript
// WRONG — Direct update without domain validation
export const makeUpdate{Entity} = (deps) => (input) => {
  return deps.repository.update(ctx, input.id, input.changes)
}

// CORRECT — Fetch, merge, re-validate, persist
return deps.repository.findById(ctx, input.id)
  .andThen((existing) => {
    const entityResult = create{Entity}({ ...existing, ...input.changes })
    if (entityResult.isErr()) {
      return errAsync({ type: 'validation_error', message: entityResult.error.message })
    }
    return deps.repository.update(ctx, input.id, entityResult.value)
  })
```

**4. Generating IDs directly**

```typescript
// WRONG — Direct dependency on nanoid
import { nanoid } from 'nanoid'
const id = nanoid()

// CORRECT — Injected via Dependencies
const id = deps.generateId()
```

**5. Authorization after business logic**

```typescript
// WRONG — DB call happens before auth check
return deps.repository.findById(ctx, id)
  .andThen((entity) => {
    if (!hasPermission(input.memberRoles, '{entities}:write')) {  // Too late!
      return errAsync({ type: 'forbidden', message: '...' })
    }
    return deps.repository.update(ctx, id, entity)
  })

// CORRECT — Auth before any work
if (!hasPermission(input.memberRoles, '{entities}:write')) {
  return errAsync({ type: 'forbidden', message: 'Insufficient permissions' })
}
return deps.repository.findById(ctx, id)
  .andThen((entity) => deps.repository.update(ctx, id, entity))
```

## Success Criteria

Before creating a use case:

- [ ] Domain entity exists for the resource (if creating/updating — see `/domain`)
- [ ] Port interface exists for the repository (see `/port`)
- [ ] Authorization is checked **FIRST** — before any business logic or DB calls
- [ ] `generateId` included in Dependencies (for create operations)
- [ ] Domain entity used to validate data before persistence (create and update)
- [ ] Error union includes `forbidden` (if auth check), `validation_error` (if domain validation), `repository_error`
- [ ] Repository errors mapped to use case errors at the boundary
- [ ] List outputs use `{ items, totalCount }` — not entity-named keys
- [ ] Type annotations on `errAsync`/`okAsync` where inference is ambiguous

## Cross-References

| Layer | Skill | Relationship |
|-------|-------|-------------|
| Architecture | `/clean-architecture` | Defines the full inside-out pipeline — use case is step 4 |
| Domain | `/domain` | Entity factory functions that use cases call for validation |
| Port | `/port` | Repository interfaces consumed via dependency injection |
| Repository | `/repository` | Drizzle implementations injected as dependencies |
| Authorization | `/authorization` | `hasPermission` function used for RBAC checks |
| Contracts | `/contracts` | Zod schemas that define the input shape arriving from procedures |
| Procedure | `/procedure` | Thin handlers that instantiate repos, call use cases, map errors |
