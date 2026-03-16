---
name: procedure
description: >-
  Thin oRPC procedures (API endpoints) that orchestrate use cases with no business logic.
  Use this skill when creating API endpoints, mapping use case results to HTTP responses,
  defining error declarations, or wiring procedures into the router. Also use when reviewing
  procedures for business logic leaks, missing error mapping, or incorrect response shaping.
  Triggers on: procedure, endpoint, handler, oRPC, API layer, router, error mapping, authProcedure.
  Do NOT load for business logic (use /use-case), domain entities (use /domain),
  database queries (use /repository), or frontend API calls (use /orpc-query).
scope: ["clean-architecture"]
---

# Procedure

Thin oRPC orchestration layer that calls use cases. Procedures have exactly 4 responsibilities: create repositories, create use case with dependencies, execute use case with context info, and map errors to HTTP responses. **No business logic lives here.**

> **Stack:** oRPC for procedures, Zod schemas from `/contracts` for input/output. Projects map path placeholders (`{api}`, `{infra}`, etc.) to their directory structure in CLAUDE.md.

## Location

```
{api}/procedures/
├── {domain}/
│   ├── create-{entity}.ts
│   ├── update-{entity}.ts
│   ├── delete-{entity}.ts
│   ├── list-{entities}.ts
│   ├── get-{entity}.ts
│   ├── map-{entity}-to-output.ts    # Response mapper (optional, when shared)
│   └── index.ts                      # Domain router (aggregates procedures)
├── router.ts                          # Main router (aggregates domain routers)
└── lib/
    └── orpc.ts                        # Base procedures + middleware
```

**Two common file organizations:**
- **Directory per domain** — one file per procedure + index.ts aggregator (preferred for large domains)
- **Single file per domain** — all procedures in one file with inline mapper functions (works for small domains with 3-5 procedures)

## Quick Start

1. Choose the base procedure type (`publicProcedure`, `sessionProcedure`, or `authProcedure`)
2. Declare procedure-specific errors with `.errors({})`
3. Set `.input()` and `.output()` from contract schemas
4. In the handler: create repos → create use case → execute → map errors → return

```typescript
export const create{Entity} = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission' },
  })
  .input(create{Entity}InputSchema)
  .output({entity}Schema)
  .handler(async ({ input, context, errors }) => {
    // 1. Create repositories
    const {entity}Repository = create{Entity}Repository(context.db)

    // 2. Create use case with dependencies
    const useCase = makeCreate{Entity}({
      {entity}Repository,
      generateId: () => crypto.randomUUID(),
    })

    // 3. Execute with context info
    const result = await useCase({
      organizationId: context.organization.id,
      memberRole: context.membership.role,
      ...input,
    })

    // 4. Map errors and return
    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'validation_error':
          throw errors.BAD_REQUEST({ message: result.error.message })
        case 'repository_error':
          throw new Error('Internal error')
      }
    }

    return result.value
  })
```

## Procedure Types

Three base procedure types, defined in the oRPC setup file. Each adds progressively more context via middleware:

| Type | Auth | Context Added | Use For |
|------|------|---------------|---------|
| `publicProcedure` | None | Base context only | Health checks, public data |
| `sessionProcedure` | Session | `user`, `session` | Onboarding, org creation |
| `authProcedure` | Session + Org | `user`, `session`, `organization`, `membership` | Most endpoints |

All procedure types inherit **common errors** (`INTERNAL_ERROR`, `NOT_FOUND`, `BAD_REQUEST`) and auth types add `UNAUTHORIZED` and `FORBIDDEN`. Procedure-specific `.errors({})` extend these with domain errors.

## Error Declarations

Declare procedure-specific errors via `.errors({})`. These errors become available as `errors.ERROR_NAME()` in the handler:

```typescript
export const update{Entity} = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to update' },
    NOT_FOUND: { message: '{Entity} not found' },
    // Domain-specific errors — only when inherited errors don't fit
    CANNOT_MODIFY: { message: 'Cannot modify in current state' },
  })
```

**Rules:**
- Only declare errors this procedure can actually throw
- Prefer inherited errors (`BAD_REQUEST`, `NOT_FOUND`, `FORBIDDEN`, `INTERNAL_ERROR`) over custom ones — declare custom errors only when none of the inherited ones fit the semantics (e.g., `CANNOT_MODIFY`, `PAYMENT_REQUIRED`)
- Error names are UPPER_SNAKE_CASE
- Messages are default descriptions — the handler can override with `throw errors.NOT_FOUND({ message: 'Custom message' })`

## Error Mapping

Map every use case error type to the appropriate procedure error with an exhaustive switch. **No `default` case** — the switch must cover every variant so TypeScript catches unhandled errors:

```typescript
if (result.isErr()) {
  switch (result.error.type) {
    case 'forbidden':
      throw errors.FORBIDDEN({ message: result.error.message })
    case 'not_found':
      throw errors.NOT_FOUND({ message: result.error.message })
    case 'validation_error':
      throw errors.BAD_REQUEST({ message: result.error.message })
    case 'repository_error':
      // Log internal errors, don't expose details to client
      console.error('Repository error:', result.error.cause)
      throw new Error('Internal error')
  }
}

return result.value
```

**Error mapping conventions:**

| Use Case Error | Procedure Error | Notes |
|----------------|----------------|-------|
| `forbidden` | `errors.FORBIDDEN()` | Forward the use case message |
| `not_found` | `errors.NOT_FOUND()` | Forward the use case message |
| `validation_error` | `errors.BAD_REQUEST()` | Forward the use case message |
| `repository_error` | `throw new Error()` | Log with `console.error` or logger, never expose cause |
| `duplicate_*` | `errors.BAD_REQUEST()` | Forward the use case message |
| `plan_limit_exceeded` | `errors.PAYMENT_REQUIRED()` | For subscription/plan limit checks |
| Custom domain errors | Custom procedure error | Declare in `.errors({})`, forward message |

## Imports

Procedures pull from four sources — contracts, use cases, repositories, and the oRPC setup:

```typescript
// Contracts (shared Zod schemas for input/output)
import { create{Entity}InputSchema, {entity}Schema } from '{contracts}/{domain}/{entity}'

// Use case factory
import { makeCreate{Entity} } from '{app}/use-cases/{domain}/create-{entity}'

// Repository factory
import { create{Entity}Repository } from '{infra}/repositories/{entity}.repository'

// Base procedure (from oRPC setup)
import { authProcedure } from '{api}/lib/orpc'
```

## Response Mappers

When the use case returns a domain entity but the API output schema expects a different shape (e.g., Date → ISO string, computed fields), use a response mapper:

### Inline mapper (small domains, few procedures)

```typescript
function to{Entity}Response({entity}: {Entity}) {
  return {
    id: {entity}.id,
    name: {entity}.name,
    status: {entity}.status,
    createdAt: {entity}.createdAt.toISOString(),
    updatedAt: {entity}.updatedAt.toISOString(),
  }
}

export const {domain}Router = {
  list: authProcedure
    .input(list{Entities}QuerySchema)
    .output(list{Entities}OutputSchema)
    .handler(async ({ input, context, errors }) => {
      // ... execute use case ...
      return {
        items: result.value.items.map(to{Entity}Response),
        totalCount: result.value.totalCount,
      }
    }),

  getById: authProcedure
    .input(get{Entity}InputSchema)
    .output({entity}Schema)
    .handler(async ({ input, context, errors }) => {
      // ... execute use case ...
      return to{Entity}Response(result.value)
    }),
}
```

### Extracted mapper (large domains, shared across procedures)

```typescript
// {api}/procedures/{domain}/map-{entity}-to-output.ts
import type { {Entity} } from '{core}/domain/entities/{entity}'

export function map{Entity}ToOutput({entity}: {Entity}) {
  return {
    id: {entity}.id,
    name: {entity}.name,
    createdAt: {entity}.createdAt.toISOString(),
    updatedAt: {entity}.updatedAt.toISOString(),
  }
}
```

**When to extract:** When 3+ procedures in the same domain map the same entity to the same output shape.

## List Procedure (Pagination)

All list procedures must pass pagination params and return `{ items, totalCount }`:

```typescript
export const list{Entities} = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission' },
  })
  .input(list{Entities}QuerySchema)
  .output(list{Entities}OutputSchema)
  .handler(async ({ input, context, errors }) => {
    const {entity}Repository = create{Entity}Repository(context.db)
    const useCase = makeList{Entities}({ {entity}Repository })

    const result = await useCase({
      organizationId: context.organization.id,
      memberRole: context.membership.role,
      search: input.search,
      limit: input.limit,
      offset: input.offset,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'repository_error':
          console.error('Repository error:', result.error.cause)
          throw new Error('Internal error')
      }
    }

    const { items, totalCount } = result.value

    return {
      items: items.map(map{Entity}ToOutput),
      totalCount,
    }
  })
```

## Delete / Archive Procedure

Delete and archive procedures typically return a simple success indicator:

```typescript
export const delete{Entity} = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission' },
    NOT_FOUND: { message: '{Entity} not found' },
  })
  .input(get{Entity}InputSchema)
  .output(z.object({ success: z.boolean() }))
  .handler(async ({ input, context, errors }) => {
    const {entity}Repository = create{Entity}Repository(context.db)
    const useCase = makeDelete{Entity}({ {entity}Repository })

    const result = await useCase({
      organizationId: context.organization.id,
      memberRole: context.membership.role,
      {entity}Id: input.id,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'not_found':
          throw errors.NOT_FOUND({ message: result.error.message })
        case 'repository_error':
          console.error('Repository error:', result.error.cause)
          throw new Error('Internal error')
      }
    }

    return { success: true }
  })
```

## Router Integration

Procedures are aggregated into domain routers, then into the main router:

### Domain router (index.ts)

```typescript
// {api}/procedures/{domain}/index.ts
import { create{Entity} } from './create-{entity}'
import { list{Entities} } from './list-{entities}'
import { get{Entity} } from './get-{entity}'
import { update{Entity} } from './update-{entity}'
import { delete{Entity} } from './delete-{entity}'

export const {entities} = {
  create: create{Entity},
  list: list{Entities},
  get: get{Entity},
  update: update{Entity},
  delete: delete{Entity},
}
```

### Main router

```typescript
// {api}/procedures/router.ts
import { {entities} } from './{domain}'
import { health } from './health'

export const router = {
  {entities},
  health,
}

export type Router = typeof router
```

The `Router` type export is used by the frontend oRPC client for type-safe API calls.

## Context Usage

The context object is enriched by middleware. Available fields depend on the procedure type:

```typescript
// publicProcedure
context.db                     // Database client
context.headers                // Request headers

// sessionProcedure (adds)
context.user                   // Authenticated user
context.user.id                // User ID
context.session                // Session object

// authProcedure (adds)
context.organization           // Current organization
context.organization.id        // Organization ID
context.organization.slug      // Organization slug
context.membership             // User's membership in this org
context.membership.id          // Member ID
context.membership.role        // User's role in this organization
```

The role lives in `membership`, not `organization` — the role describes the user's relationship to the org, not a property of the org itself. Read the project's `orpc.ts` to discover the exact context shape.

## Common Violations

**1. Business logic in procedures**

```typescript
// WRONG — Business rule in procedure
.handler(async ({ input }) => {
  if (input.amount > 1000) {  // This belongs in a use case!
    throw errors.LIMIT_EXCEEDED()
  }
})

// CORRECT — Procedure only orchestrates
.handler(async ({ input, context, errors }) => {
  const result = await useCase(input)
  if (result.isErr()) { /* map errors */ }
  return result.value
})
```

**2. Missing error cases in switch**

```typescript
// WRONG — Missing 'repository_error' case
switch (result.error.type) {
  case 'forbidden':
    throw errors.FORBIDDEN()
  case 'not_found':
    throw errors.NOT_FOUND()
  // repository_error is silently unhandled!
}

// CORRECT — Exhaustive switch (every error type mapped)
switch (result.error.type) {
  case 'forbidden':
    throw errors.FORBIDDEN({ message: result.error.message })
  case 'not_found':
    throw errors.NOT_FOUND({ message: result.error.message })
  case 'repository_error':
    console.error('Repository error:', result.error.cause)
    throw new Error('Internal error')
}
```

**3. Exposing internal error details**

```typescript
// WRONG — Leaking database error to client
case 'repository_error':
  throw errors.INTERNAL_ERROR({ message: result.error.cause.toString() })

// CORRECT — Log internally, return generic message
case 'repository_error':
  console.error('Repository error:', result.error.cause)
  throw new Error('Internal error')
```

**4. Using `default` case instead of exhaustive switch**

```typescript
// WRONG — Hides unhandled error types
switch (result.error.type) {
  case 'forbidden':
    throw errors.FORBIDDEN()
  default:
    throw new Error('Unknown error')
}

// CORRECT — Exhaustive: TypeScript flags missing cases
switch (result.error.type) {
  case 'forbidden':
    throw errors.FORBIDDEN({ message: result.error.message })
  case 'not_found':
    throw errors.NOT_FOUND({ message: result.error.message })
  case 'repository_error':
    console.error('Repository error:', result.error.cause)
    throw new Error('Internal error')
}
```

**5. Direct database queries in procedures**

```typescript
// WRONG — Direct DB access
.handler(async ({ input, context }) => {
  const items = await context.db.select().from(table)
  return { items, totalCount: items.length }
})

// CORRECT — Delegate to use case via repository
.handler(async ({ input, context, errors }) => {
  const repo = createRepository(context.db)
  const useCase = makeListItems({ repo })
  const result = await useCase({ ...input })
  // ... map result
})
```

## Success Criteria

When creating a new procedure:

- [ ] Correct base procedure type chosen (`publicProcedure`, `sessionProcedure`, or `authProcedure`)
- [ ] Procedure-specific errors declared with `.errors({})`
- [ ] Input schema set with `.input()` from contracts
- [ ] Output schema set with `.output()` from contracts
- [ ] Handler creates repositories from `context.db`
- [ ] Handler creates use case with dependencies (including `generateId` for create operations)
- [ ] Handler executes use case with context info (`organizationId`, `memberRole`, etc.)
- [ ] All use case error types mapped with exhaustive switch (no `default`)
- [ ] Repository errors logged internally, never exposed to client
- [ ] Response mapped to output schema shape (via mapper function if needed)
- [ ] Procedure added to domain router and main router
- [ ] **NO business logic in the handler**
- [ ] **List procedures return `{ items, totalCount }` with pagination params passed through**

## Cross-References

| When | Skill |
|------|-------|
| Defining the use case this procedure calls | `/use-case` |
| Defining input/output Zod schemas | `/contracts` |
| Understanding the full backend flow | `/clean-architecture` |
| Implementing the repository injected here | `/repository` |
| Checking authorization patterns used in the use case | `/authorization` |
| Building frontend hooks that call these procedures | `/orpc-query` |
