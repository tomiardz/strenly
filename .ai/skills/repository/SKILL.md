---
name: repository
description: >-
  Drizzle ORM repository implementations for port interfaces in Clean Architecture.
  Use this skill when implementing a repository that fulfills a port contract, writing
  database queries with Drizzle, handling multi-tenancy filtering, or working with
  ResultAsync.fromPromise for error handling. Also use when reviewing repository code
  for missing tenant scoping, incorrect reconstitution, or pagination issues.
  Do NOT load for port definitions (use /port), business logic (use /use-case), or API contracts.
scope: ["clean-architecture"]
---

# Repository (Drizzle Implementation)

Implements port interfaces using Drizzle ORM. Repositories are the only layer that knows about the database — they translate between domain entities and database rows. All methods return `ResultAsync<T, Error>` via neverthrow.

> **Stack:** Drizzle ORM + neverthrow. Projects map path placeholders (`{infra}`, `{core}`, etc.) to their directory structure in CLAUDE.md.

## Location

```
{infra}/repositories/
├── {entity}.repository.ts        # One file per entity/aggregate
└── db-error.ts                   # Shared error utilities (optional)
```

## Factory Function

Every repository is a factory that receives the database client and returns the port implementation:

```typescript
// {infra}/repositories/{entity}.repository.ts
import type { {Entity}RepositoryPort } from '{core}/ports/{entity}-repository.port'
import type { DbClient } from '{database}/client'
import { {entities}Table } from '{database}/schema'
import { and, eq, isNull } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

export function create{Entity}Repository(db: DbClient): {Entity}RepositoryPort {
  return {
    findById: (ctx, id) => /* ... */,
    findAll: (ctx, options) => /* ... */,
    create: (ctx, entity) => /* ... */,
    // ... implements every method from the port
  }
}
```

The factory receives `DbClient` (request-scoped) — not a global connection. This enables transaction support when the same `db` handle is a transaction client.

## Error Wrapping

Every repository needs a `wrapError` helper that converts unknown database exceptions into typed errors. Two common shapes:

```typescript
// Curried — when you want per-operation context
function wrapError(operation: string) {
  return (cause: unknown): {Entity}RepositoryError => ({
    type: 'DATABASE_ERROR',
    message: `Failed to ${operation}`,
    cause,
  })
}

// Direct — simpler, when the error type carries enough info
function wrapDbError(cause: unknown): {Entity}RepositoryError {
  return {
    type: 'DATABASE_ERROR',
    message: cause instanceof Error ? cause.message : 'Database operation failed',
    cause,
  }
}
```

Use the curried form when debugging benefits from knowing which operation failed. Use the direct form when the port's error type is flat.

## Core Pattern: ResultAsync.fromPromise

Every method wraps Drizzle queries in `ResultAsync.fromPromise` — never throw, never return raw promises:

```typescript
findById: (ctx, id) =>
  ResultAsync.fromPromise(
    db
      .select()
      .from({entities}Table)
      .where(
        and(
          eq({entities}Table.id, id),
          eq({entities}Table.organizationId, ctx.organizationId),
          isNull({entities}Table.deletedAt),
        ),
      )
      .then((rows) => rows[0] ?? null),
    wrapError('findById'),
  ),
```

For multi-step operations, use an async IIFE:

```typescript
create: (ctx, entity) =>
  ResultAsync.fromPromise(
    (async () => {
      const [row] = await db
        .insert({entities}Table)
        .values({ /* ... */ })
        .returning()

      if (!row) throw new Error('Insert returned no rows')
      return reconstitute{Entity}(row)
    })(),
    wrapError('create'),
  ),
```

## Multi-Tenancy

**Every query on tenant-scoped data MUST filter by context.** This is the repository's primary security responsibility — without it, users can access other tenants' data.

```typescript
// EVERY where clause includes organizationId
.where(
  and(
    eq({entities}Table.id, id),
    eq({entities}Table.organizationId, ctx.organizationId),  // REQUIRED
    isNull({entities}Table.deletedAt),                       // Soft delete filter
  ),
)
```

For global/reference data (plans, system config, shared catalogs), the port won't have a Context parameter — no tenant filtering needed:

```typescript
// Global repository — no ctx parameter
findAll: () =>
  ResultAsync.fromPromise(
    db.select().from(plansTable).orderBy(plansTable.name),
    wrapDbError,
  ),
```

## Reconstitution vs Projection

Repositories return data in two ways depending on the operation:

**Reconstitution** — for operations where the consumer (use case) will perform domain operations. Uses `reconstitute{Entity}()` from the domain layer, which constructs the entity type skipping validation (data is already valid — it passed through the factory when created):

```typescript
import { reconstitute{Entity} } from '{core}/domain/entities/{entity}'

findById: (ctx, id) =>
  ResultAsync.fromPromise(
    (async () => {
      const row = await db.select().from({entities}Table)
        .where(/* ... */)
        .then((rows) => rows[0])

      if (!row) return null
      return reconstitute{Entity}({
        id: row.id,
        organizationId: row.organizationId,
        name: row.name,
        status: row.status,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      })
    })(),
    wrapError('findById'),
  ),
```

**Projection** — for list/query operations where data goes straight to the API response. Select only needed columns, map directly to the list item type defined in the port — no reconstitution:

```typescript
findAll: (ctx, options) =>
  ResultAsync.fromPromise(
    (async () => {
      const whereClause = and(
        eq({entities}Table.organizationId, ctx.organizationId),
        isNull({entities}Table.deletedAt),
      )

      const [countResult, rows] = await Promise.all([
        db.select({ count: count() }).from({entities}Table).where(whereClause),
        db.select({
            id: {entities}Table.id,
            name: {entities}Table.name,
            status: {entities}Table.status,
            createdAt: {entities}Table.createdAt,
          })
          .from({entities}Table)
          .where(whereClause)
          .orderBy({entities}Table.name)
          .limit(options.limit)
          .offset(options.offset),
      ])

      return {
        items: rows,
        totalCount: countResult[0]?.count ?? 0,
      }
    })(),
    wrapError('findAll'),
  ),
```

**When to use which:**

| Operation | Approach | Why |
|-----------|----------|-----|
| `findById` | Reconstitute | Use case will operate on the entity |
| `create` / `update` return | Reconstitute | Confirms post-mutation state |
| `findAll` (simple entity) | Either — both valid | Cost difference is negligible |
| `findAll` (aggregate with children) | Projection | Loading children for a table listing is wasteful |
| `load` (full aggregate) | Reconstitute | Use case needs the complete aggregate |

For simple entities without children, reconstituting in `findAll` is acceptable — the overhead is zero. For aggregates with deep children, projection is the correct choice.

## Paginated Lists

**ALL `findAll` methods MUST return `{ items, totalCount }`.** The count query uses the same `whereClause` as the items query — run them in parallel with `Promise.all` for efficiency:

```typescript
findAll: (ctx, options) =>
  ResultAsync.fromPromise(
    (async () => {
      const conditions: SQL[] = [
        eq({entities}Table.organizationId, ctx.organizationId),
        isNull({entities}Table.deletedAt),
      ]

      // Dynamic filters
      if (options.search) {
        const escaped = options.search.replace(/[%_]/g, '\\$&')
        conditions.push(ilike({entities}Table.name, `%${escaped}%`))
      }

      if (options.status) {
        conditions.push(eq({entities}Table.status, options.status))
      }

      const whereClause = and(...conditions)

      // Parallel count + items
      const [countResult, rows] = await Promise.all([
        db.select({ count: count() }).from({entities}Table).where(whereClause),
        db
          .select()
          .from({entities}Table)
          .where(whereClause)
          .orderBy(desc({entities}Table.createdAt))
          .limit(options.limit)
          .offset(options.offset),
      ])

      return {
        items: rows.map(/* reconstitute or project */),
        totalCount: countResult[0]?.count ?? 0,
      }
    })(),
    wrapError('findAll'),
  ),
```

**Key rules:**
- `items` key — always `items`, never entity-named keys (`users`, `exercises`)
- Same `whereClause` for count and items — so counts reflect filters
- Escape search wildcards — prevent `%` and `_` in user input from acting as SQL wildcards
- `limit` and `offset` are required in the port's options type — see `/port`

## Transactions

Use `db.transaction()` when an operation touches multiple tables. The callback receives a transaction client (`tx`) — use it for all queries within the transaction. Throwing inside the callback triggers automatic rollback:

```typescript
create: (ctx, entity) =>
  ResultAsync.fromPromise(
    db.transaction(async (tx) => {
      // 1. Insert parent
      const [row] = await tx
        .insert({entities}Table)
        .values({
          id: entity.id,
          organizationId: ctx.organizationId,
          name: entity.name,
          // ...
        })
        .returning()

      if (!row) throw new Error('Insert returned no rows')

      // 2. Insert children
      if (entity.children.length > 0) {
        await tx.insert(childrenTable).values(
          entity.children.map((child) => ({
            parentId: row.id,
            // ...
          })),
        )
      }

      return reconstitute{Entity}(row, entity.children)
    }),
    wrapError('create'),
  ),
```

### Junction Table Updates

For many-to-many relationships, the standard pattern is delete-and-reinsert within a transaction:

```typescript
update: (ctx, entity) =>
  ResultAsync.fromPromise(
    db.transaction(async (tx) => {
      // 1. Update parent
      const [row] = await tx
        .update({entities}Table)
        .set({ name: entity.name, updatedAt: new Date() })
        .where(and(
          eq({entities}Table.id, entity.id),
          eq({entities}Table.organizationId, ctx.organizationId),
        ))
        .returning()

      if (!row) throw new Error('Not found')

      // 2. Replace junction records
      await tx.delete(entityTagsTable).where(eq(entityTagsTable.entityId, entity.id))

      if (entity.tagIds.length > 0) {
        await tx.insert(entityTagsTable).values(
          entity.tagIds.map((tagId) => ({
            entityId: entity.id,
            tagId,
          })),
        )
      }

      return reconstitute{Entity}(row, entity.tagIds)
    }),
    wrapError('update'),
  ),
```

## Post-Processing with andThen

Use `.andThen()` to chain domain logic after the database query — particularly useful when the DB result needs validation or transformation before returning:

```typescript
archive: (ctx, id) =>
  ResultAsync.fromPromise(
    db
      .update({entities}Table)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq({entities}Table.id, id),
        eq({entities}Table.organizationId, ctx.organizationId),
      ))
      .returning(),
    wrapDbError,
  ).andThen((rows) => {
    if (rows.length === 0) {
      return err({ type: 'NOT_FOUND', {entity}Id: id } as const)
    }
    return ok(undefined)
  }),
```

This pattern is cleaner than checking inside the IIFE because it keeps error branching in the `Result` chain rather than mixing `throw` and `return err()`.

## Helper Functions

Extract reusable query logic into private helpers — especially for loading related data that multiple methods need:

```typescript
// Private helper — not exported, not part of the port
async function fetchRelatedItems(db: DbClient, parentId: string) {
  return db
    .select({
      id: relatedTable.id,
      name: relatedTable.name,
    })
    .from(relatedTable)
    .where(eq(relatedTable.parentId, parentId))
}

// Used in multiple repository methods
findById: (ctx, id) =>
  ResultAsync.fromPromise(
    (async () => {
      const row = await db.select().from({entities}Table).where(/* ... */).then((r) => r[0])
      if (!row) return null

      const related = await fetchRelatedItems(db, row.id)
      return reconstitute{Entity}(row, related)
    })(),
    wrapError('findById'),
  ),
```

## Mapper Functions

When database rows need non-trivial transformation (value narrowing, type guards, joining multiple sources), extract a dedicated mapper:

```typescript
type {Entity}Row = typeof {entities}Table.$inferSelect

function mapToDomain(row: {Entity}Row): {Entity} {
  return reconstitute{Entity}({
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    // Type narrowing for value objects
    status: isValidStatus(row.status) ? row.status : 'draft',
    // Nullable field handling
    description: row.description,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  })
}
```

Use `typeof table.$inferSelect` from Drizzle to type database rows without manual type definitions.

## Unique Violation Detection

For operations that may hit unique constraints (create, update with unique fields), detect PostgreSQL error code `23505`:

```typescript
function isUniqueViolation(cause: unknown): boolean {
  if (typeof cause !== 'object' || cause === null) return false
  if (!('code' in cause)) return false
  return cause.code === '23505'
}

// Used in wrapError to produce a specific error type
create: (ctx, entity) =>
  ResultAsync.fromPromise(
    db.insert({entities}Table).values({ /* ... */ }).returning(),
    (cause) => {
      if (isUniqueViolation(cause)) {
        return { type: 'ALREADY_EXISTS', name: entity.name }
      }
      return wrapDbError(cause)
    },
  ),
```

## Common Violations

**1. Missing tenant filtering**

```typescript
// WRONG — no tenant isolation
.where(eq({entities}Table.id, id))

// CORRECT — always filter by context
.where(and(eq({entities}Table.id, id), eq({entities}Table.organizationId, ctx.organizationId)))
```

**2. Separate count query with different filters**

```typescript
// WRONG — count doesn't match items filters
const total = await db.select({ count: count() }).from({entities}Table)
const items = await db.select().from({entities}Table).where(and(...filters))

// CORRECT — same whereClause for both
const whereClause = and(...conditions)
const [countResult, rows] = await Promise.all([
  db.select({ count: count() }).from({entities}Table).where(whereClause),
  db.select().from({entities}Table).where(whereClause).limit(options.limit).offset(options.offset),
])
```

**3. Returning entity-named keys instead of `items`**

```typescript
// WRONG
return { users: rows.map(mapToDomain), totalCount }

// CORRECT
return { items: rows.map(mapToDomain), totalCount }
```

**4. Throwing instead of returning through Result chain**

```typescript
// WRONG — mixing throw and Result
findById: (ctx, id) =>
  ResultAsync.fromPromise(/* ... */).map((row) => {
    if (!row) throw new Error('Not found')  // Escapes the Result chain
    return row
  })

// CORRECT — return null for not found (let use case decide what to do)
findById: (ctx, id) =>
  ResultAsync.fromPromise(
    db.select().from(table).where(/* ... */).then((rows) => rows[0] ?? null),
    wrapError('findById'),
  ),
```

**5. Loading full aggregate children for list operations**

```typescript
// WRONG — N+1 queries loading children just for a table listing
findAll: (ctx, options) =>
  ResultAsync.fromPromise(
    (async () => {
      const rows = await db.select().from(table).where(/* ... */)
      // Loading all children for each row — expensive and unnecessary
      for (const row of rows) {
        row.children = await db.select().from(childrenTable).where(/* ... */)
      }
      return { items: rows.map(reconstituteFullAggregate), totalCount }
    })(),
    wrapError('findAll'),
  )

// CORRECT — project to summary type, no children
findAll: (ctx, options) =>
  ResultAsync.fromPromise(
    (async () => {
      const rows = await db
        .select({ id: table.id, name: table.name, status: table.status })
        .from(table)
        .where(/* ... */)
      return { items: rows, totalCount }
    })(),
    wrapError('findAll'),
  )
```

## Success Criteria

- [ ] Factory function receives `DbClient`, returns port implementation
- [ ] `wrapError` helper defined — all errors are typed, never raw exceptions
- [ ] All tenant-scoped methods receive Context and filter by `organizationId`
- [ ] All methods return `ResultAsync<T, Error>` — no thrown exceptions, no raw promises
- [ ] `findById` returns `T | null` for not found (not an error)
- [ ] `findAll` returns `{ items, totalCount }` — count uses same filters as items
- [ ] Reconstitution used for command operations (findById, create, update)
- [ ] Projections used for list operations on aggregates with children
- [ ] Multi-table operations use `db.transaction()` with rollback on throw
- [ ] Search input wildcards (`%`, `_`) are escaped before `ilike`

## Cross-References

| Layer | Skill | Relationship |
|-------|-------|-------------|
| Architecture | `/clean-architecture` | Defines the full inside-out pipeline — repository is step 3 |
| Domain | `/domain` | Entity types and `reconstitute` functions the repository uses |
| Port | `/port` | Interface contracts this repository implements |
| Use Case | `/use-case` | Consumes repositories via dependency injection |
