---
name: port
description: >-
  Repository port interfaces (data access contracts) in Clean Architecture.
  Use this skill when defining repository interfaces, creating data access contracts,
  or working with Context for multi-tenancy. Also use when reviewing port definitions
  for missing pagination, incorrect error types, or tenant scoping issues.
  Do NOT load for repository implementations (use /repository), use case logic, or API contracts.
scope: ["clean-architecture"]
---

# Port (Repository Interface)

Defines repository contracts (interfaces) that implementations must follow. Ports live in the core layer — they declare **what** data operations exist without knowing **how** they're implemented. All methods return `ResultAsync<T, Error>` via neverthrow.

> **Stack:** neverthrow for Result types. Projects map path placeholders (`{core}`, etc.) to their directory structure in CLAUDE.md.

## Location

```
{core}/ports/
├── types.ts                          # Shared types (RepositoryError, PaginatedResult)
├── {entity}-repository.port.ts       # Per-entity repository contract
└── {service}.port.ts                 # Non-repository ports (external APIs, etc.)
```

## Shared Base Types

Define these once in `{core}/ports/types.ts` — all ports import from here:

```typescript
import type { ResultAsync } from 'neverthrow'

export type RepositoryError = {
  type: 'DATABASE_ERROR'
  message: string
  cause?: unknown
}

export const repositoryError = (message: string, cause: unknown): RepositoryError => ({
  type: 'DATABASE_ERROR',
  message,
  cause,
})

export type PaginationOptions = {
  limit: number
  offset: number
}

export type PaginatedResult<T> = {
  items: T[]
  totalCount: number
}

export type RepositoryResult<T> = ResultAsync<T, RepositoryError>
```

> **Context type:** Projects define their own context type (e.g., `OrganizationContext = { organizationId: string }` for multi-tenant apps). Read the project's existing ports to discover the context shape.

## Port Template

```typescript
// {core}/ports/{entity}-repository.port.ts
import type { ResultAsync } from 'neverthrow'
import type { {Entity} } from '../domain/entities/{entity}'
import type { RepositoryError } from './types'

// Entity-specific errors extend the base RepositoryError
export type {Entity}RepositoryError =
  | { type: 'NOT_FOUND'; {entity}Id: string }
  | RepositoryError

export type Create{Entity}Data = {
  id: string
  name: string
  // ... required fields for creation
}

export type Update{Entity}Data = {
  name?: string
  // ... optional fields for partial updates
}

export type List{Entities}Options = {
  // Filters (domain-specific)
  search?: string
  status?: string
  // Pagination (REQUIRED — not optional)
  limit: number
  offset: number
}

export type {Entity}RepositoryPort = {
  findById(ctx: Context, id: string): ResultAsync<{Entity} | null, {Entity}RepositoryError>

  findAll(
    ctx: Context,
    options: List{Entities}Options,
  ): ResultAsync<{ items: {Entity}[]; totalCount: number }, {Entity}RepositoryError>

  create(ctx: Context, data: Create{Entity}Data): ResultAsync<{Entity}, {Entity}RepositoryError>

  update(ctx: Context, id: string, data: Update{Entity}Data): ResultAsync<{Entity} | null, {Entity}RepositoryError>

  softDelete(ctx: Context, id: string): ResultAsync<void, {Entity}RepositoryError>

  existsBy{Field}(ctx: Context, value: string, excludeId?: string): ResultAsync<boolean, {Entity}RepositoryError>
}
```

## Method Naming Conventions

| Pattern | Signature | Returns |
|---------|-----------|---------|
| `findById` | `(ctx, id)` | `T \| null` |
| `findAll` | `(ctx, options)` | `{ items: T[], totalCount: number }` |
| `findBy{X}` | `(ctx, value)` | `T[]` |
| `create` | `(ctx, data)` | `T` |
| `update` | `(ctx, id, data)` | `T \| null` |
| `softDelete` / `archive` | `(ctx, id)` | `void` |
| `existsBy{X}` | `(ctx, value, excludeId?)` | `boolean` |

## Pagination Requirements

**ALL `findAll` methods MUST return `{ items, totalCount }`.**

```typescript
// WRONG — returns bare array
findAll(ctx: Context, options: ListOptions): ResultAsync<{Entity}[], RepositoryError>

// WRONG — uses entity-named key
findAll(ctx: Context, options: ListOptions): ResultAsync<{ users: User[], totalCount: number }, RepositoryError>

// CORRECT — uses `items` key + `totalCount`
findAll(ctx: Context, options: ListOptions): ResultAsync<{ items: {Entity}[], totalCount: number }, RepositoryError>
```

**Why:**
- Frontend DataTable pagination requires `totalCount` to render page controls
- The `items` key is the standard across all list endpoints — not entity-named keys
- `limit` and `offset` in options are **required**, not optional

## Entity-Specific Error Types

Ports define their own error union that extends the base `RepositoryError`:

```typescript
// Simple — just NOT_FOUND + base error
export type {Entity}RepositoryError =
  | { type: 'NOT_FOUND'; {entity}Id: string }
  | RepositoryError

// Complex — multiple entity types (aggregates with nested entities)
export type {Entity}RepositoryError =
  | { type: 'NOT_FOUND'; entityType: 'parent' | 'child' | 'grandchild'; id: string }
  | RepositoryError
```

Use cases and procedures match on these `.type` discriminants for exhaustive error handling.

## Tenant Scoping

**Tenant-scoped** ports — all methods receive Context (first parameter):

```typescript
export type {Entity}RepositoryPort = {
  findById(ctx: Context, id: string): ResultAsync<{Entity} | null, {Entity}RepositoryError>
  create(ctx: Context, data: Create{Entity}Data): ResultAsync<{Entity}, {Entity}RepositoryError>
}
```

**Global** ports — no Context parameter (system-wide data):

```typescript
export type PlanRepositoryPort = {
  findById(id: string): ResultAsync<Plan | null, RepositoryError>
  findAll(): ResultAsync<Plan[], RepositoryError>
}
```

> **Rule of thumb:** If the data belongs to an organization/tenant, it needs Context. If it's shared reference data (plans, system config), it doesn't.

## Aggregate Ports

For aggregate roots that own child entities, the port exposes `load` and `save` operations on the full aggregate — not individual CRUD on children:

```typescript
export type {Aggregate}RepositoryPort = {
  // Load the full aggregate with all children
  load(ctx: Context, id: string): ResultAsync<{Aggregate} | null, {Aggregate}RepositoryError>

  // Save the full aggregate atomically (replace-on-save)
  save(ctx: Context, aggregate: {Aggregate}): ResultAsync<void, {Aggregate}RepositoryError>

  // List aggregates (summary view, without full children)
  findAll(
    ctx: Context,
    options: List{Aggregates}Options,
  ): ResultAsync<{ items: {Aggregate}[]; totalCount: number }, {Aggregate}RepositoryError>
}
```

The repository implementation handles persisting all children in a single transaction. See `/domain` for aggregate boundary guidelines.

## Non-Repository Ports

Not all ports are repository interfaces. External service integrations also use the port pattern:

```typescript
// {core}/ports/{service}.port.ts
export type {Service}Error =
  | { type: 'NOT_FOUND' }
  | { type: 'API_ERROR'; cause: unknown }

export type {Service}Port = {
  fetch(input: FetchInput): ResultAsync<FetchResult, {Service}Error>
}
```

Same rules apply: return `ResultAsync`, use discriminated union errors, keep in the core layer.

## Key Patterns

1. **Entity type is imported from domain** — ports reference domain entity types, not their own type definitions
2. **Return `null` for not found** — `findById` returns `T | null`, not an error
3. **Context is always the first parameter** — consistent across all tenant-scoped methods
4. **Use `ResultAsync<T, Error>`** — never throw, never return raw promises
5. **Separate input types** — `Create{Entity}Data` and `Update{Entity}Data` are distinct types
6. **JSDoc on non-obvious methods** — explain what each method returns and when `null` is returned

## Common Violations

**1. Missing totalCount in list operations**

```typescript
// WRONG — no pagination support
findAll(ctx: Context): ResultAsync<{Entity}[], RepositoryError>

// CORRECT — paginated with totalCount
findAll(ctx: Context, options: ListOptions): ResultAsync<{ items: {Entity}[]; totalCount: number }, RepositoryError>
```

**2. Missing Context parameter**

```typescript
// WRONG — no tenant isolation
findById(id: string): ResultAsync<{Entity} | null, RepositoryError>

// CORRECT — tenant-scoped
findById(ctx: Context, id: string): ResultAsync<{Entity} | null, RepositoryError>
```

**3. Using generic RepositoryError when entity-specific errors exist**

```typescript
// WRONG — loses NOT_FOUND specificity
findById(ctx: Context, id: string): ResultAsync<{Entity} | null, RepositoryError>

// CORRECT — entity-specific error union
findById(ctx: Context, id: string): ResultAsync<{Entity} | null, {Entity}RepositoryError>
```

**4. Exposing child CRUD on aggregate ports**

```typescript
// WRONG — breaks aggregate boundary
export type OrderRepositoryPort = {
  findOrderById(ctx: Context, id: string): ResultAsync<Order | null, Error>
  createOrderItem(ctx: Context, orderId: string, item: OrderItem): ResultAsync<OrderItem, Error>
  deleteOrderItem(ctx: Context, itemId: string): ResultAsync<void, Error>
}

// CORRECT — load/save the full aggregate
export type OrderRepositoryPort = {
  load(ctx: Context, id: string): ResultAsync<Order | null, Error>
  save(ctx: Context, order: Order): ResultAsync<void, Error>
}
```

## Success Criteria

- [ ] Port file created at `{core}/ports/{entity}-repository.port.ts`
- [ ] Entity type imported from domain (not redefined in port)
- [ ] Entity-specific error type defined as union with `RepositoryError`
- [ ] All tenant-scoped methods receive Context as first parameter
- [ ] All methods return `ResultAsync<T, {Entity}RepositoryError>`
- [ ] `findById` returns `T | null` (not error for missing)
- [ ] `findAll` returns `{ items: T[], totalCount: number }` with required `limit` + `offset`
- [ ] Separate `Create{Entity}Data` and `Update{Entity}Data` types defined
- [ ] Aggregate ports use `load`/`save` pattern (not child CRUD)

## Cross-References

| Layer | Skill | Relationship |
|-------|-------|-------------|
| Architecture | `/clean-architecture` | Defines the full inside-out pipeline — port is step 2 |
| Domain | `/domain` | Entity types that ports reference; aggregate boundaries that shape port design |
| Repository | `/repository` | Drizzle implementations of these port interfaces |
| Use Case | `/use-case` | Consumes ports via dependency injection |
