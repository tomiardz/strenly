# Layer Examples - Complete Code

> Stack: **neverthrow** + **Drizzle ORM** + **oRPC** + **Zod**
> Path placeholders (`{core}`, `{infra}`, etc.) map to your project's directory structure — see CLAUDE.md.

Replace `{Entity}`, `{entity}`, `{entities}` with your actual entity name (e.g., User, Product, Order).

## Table of Contents

- [Stack Overview](#stack-overview)
- [1. Domain Entity](#1-domain-entity) — `{core}/domain/entities/{entity}.ts`
- [2. Port](#2-port) — `{core}/ports/{entity}-repository.port.ts`
- [3. Repository](#3-repository) — `{infra}/repositories/{entity}.repository.ts`
- [4. Use Case](#4-use-case-with-authorization) — `{app}/use-cases/{domain}/create-{entity}.ts`
- [5. Contracts](#5-contracts) — `{contracts}/{domain}/{entity}.ts`
- [6. Procedure](#6-procedure) — `{api}/procedures/{domain}/create-{entity}.ts`
- [Template Variables](#template-variables)

---

## Stack Overview

```
┌────────────────────────────────────────────────────────────────────┐
│ FRONTEND                                                           │
│ - React + TanStack Router/Query                                    │
│ - Forms: React Hook Form + Zod resolver                            │
│ - Tables: DataTable with server-side pagination                    │
└────────────────────────────────────────────────────────────────────┘
                               ↕ API (oRPC)
┌────────────────────────────────────────────────────────────────────┐
│ PROCEDURES — {api}/procedures/                                     │
│ - Thin oRPC handlers — ONLY orchestration                          │
│ - Create repos → call use case → map errors                        │
│ - NO business logic                                                │
└────────────────────────────────────────────────────────────────────┘
                               ↓
┌────────────────────────────────────────────────────────────────────┐
│ USE CASES — {app}/use-cases/                                       │
│ - Business logic orchestration                                     │
│ - Authorization FIRST (hasPermission)                              │
│ - Domain validation BEFORE persist                                 │
│ - ResultAsync for error handling (neverthrow)                      │
└────────────────────────────────────────────────────────────────────┘
                               ↓
┌────────────────────────────────────────────────────────────────────┐
│ REPOSITORIES — {infra}/repositories/                               │
│ - Implement Port interfaces                                        │
│ - Drizzle ORM queries                                              │
│ - ALWAYS filter by context (tenant isolation)                      │
│ - ALWAYS return totalCount for lists                               │
└────────────────────────────────────────────────────────────────────┘
                               ↓
┌────────────────────────────────────────────────────────────────────┐
│ CORE — {core}/                                                     │
│ - Domain Entities: validation, factory functions (neverthrow)      │
│ - Ports: repository interfaces (ResultAsync)                       │
│ - Services: authorization (pure functions)                         │
└────────────────────────────────────────────────────────────────────┘
                               ↓
┌────────────────────────────────────────────────────────────────────┐
│ CONTRACTS — {contracts}/                                           │
│ - Zod schemas for API boundary                                     │
│ - Shared between frontend and backend                              │
└────────────────────────────────────────────────────────────────────┘
```

---

## 1. Domain Entity

Location: `{core}/domain/entities/{entity}.ts`

```typescript
// {core}/domain/entities/{entity}.ts
import { err, ok, type Result } from 'neverthrow'

type DomainError = {
  entity: string
  field: string
  message: string
}

const ENTITY = '{entity}'

// Immutable types
export type {Entity} = {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly email: string
  readonly status: 'active' | 'inactive'
}

export type Create{Entity}Input = {
  id: string  // ID comes from use case (injected dependency)
  organizationId: string
  name: string
  email: string
}

// Field validation (one function per field)
const validateName = (name: string): Result<string, DomainError> => {
  if (name.length < 1) {
    return err({ entity: ENTITY, field: 'name', message: 'Name is required' })
  }
  if (name.length > 100) {
    return err({ entity: ENTITY, field: 'name', message: 'Name is too long' })
  }
  return ok(name)
}

const validateEmail = (email: string): Result<string, DomainError> => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return err({ entity: ENTITY, field: 'email', message: 'Invalid email format' })
  }
  return ok(email)
}

// Factory function that validates — NEVER throws, returns Result
export const create{Entity} = (input: Create{Entity}Input): Result<{Entity}, DomainError> => {
  const nameResult = validateName(input.name)
  if (nameResult.isErr()) return err(nameResult.error)

  const emailResult = validateEmail(input.email)
  if (emailResult.isErr()) return err(emailResult.error)

  return ok({
    id: input.id,
    organizationId: input.organizationId,
    name: nameResult.value,
    email: emailResult.value,
    status: 'active',
  })
}

// Query helpers (pure functions) — use Pick<> for minimal dependencies
export const isActive = (entity: Pick<{Entity}, 'status'>): boolean => {
  return entity.status === 'active'
}
```

---

## 2. Port

Location: `{core}/ports/{entity}-repository.port.ts`

```typescript
// {core}/ports/{entity}-repository.port.ts
import type { ResultAsync } from 'neverthrow'

// Define Context per project (e.g., OrganizationContext with organizationId)
export type Context = {
  organizationId: string
  // Add other context fields your project needs
}

export type RepositoryError = {
  type: 'repository_error'
  operation: string
  cause: unknown
}

export type {Entity} = {
  id: string
  organizationId: string
  name: string
  email: string
  createdAt: Date
  updatedAt: Date
}

export type Create{Entity}Data = {
  id: string
  name: string
  email: string
}

export type Update{Entity}Data = Partial<Omit<Create{Entity}Data, 'id'>>

export type List{Entities}Options = {
  search?: string
  status?: string
  limit: number   // REQUIRED — never optional
  offset: number  // REQUIRED — never optional
}

// List result uses `items` key — consistent across all entities
export type List{Entities}Result = {
  items: {Entity}[]
  totalCount: number  // REQUIRED for frontend pagination
}

// Repository interface — all methods return ResultAsync
export type {Entity}Repository = {
  create: (ctx: Context, data: Create{Entity}Data)
    => ResultAsync<{Entity}, RepositoryError>

  findById: (ctx: Context, id: string)
    => ResultAsync<{Entity} | null, RepositoryError>

  update: (ctx: Context, id: string, data: Update{Entity}Data)
    => ResultAsync<{Entity} | null, RepositoryError>

  softDelete: (ctx: Context, id: string)
    => ResultAsync<void, RepositoryError>

  // REQUIRED: returns { items, totalCount }
  findAll: (ctx: Context, options: List{Entities}Options)
    => ResultAsync<List{Entities}Result, RepositoryError>

  existsByEmail: (ctx: Context, email: string, excludeId?: string)
    => ResultAsync<boolean, RepositoryError>
}
```

---

## 3. Repository

Location: `{infra}/repositories/{entity}.repository.ts`

```typescript
// {infra}/repositories/{entity}.repository.ts
import type { {Entity}Repository, List{Entities}Result, Context, RepositoryError } from '{core}/ports/{entity}-repository.port'
import { {entities}Table } from '{your-db-schema-import}'
import { and, eq, count, ilike, type SQL } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

// Error wrapper — define at top of every repository
const wrapError = (operation: string) => (cause: unknown): RepositoryError => ({
  type: 'repository_error',
  operation,
  cause,
})

// Factory function — receives the Drizzle db client
export const create{Entity}Repository = (db: DbClient): {Entity}Repository => ({
  create: (ctx, data) =>
    ResultAsync.fromPromise(
      (async () => {
        await db.insert({entities}Table).values({
          id: data.id,
          organizationId: ctx.organizationId,  // Always from context
          name: data.name,
          email: data.email,
        })

        const [result] = await db
          .select()
          .from({entities}Table)
          .where(eq({entities}Table.id, data.id))

        if (!result) throw new Error('Failed to fetch created record')
        return reconstitute{Entity}(result)
      })(),
      wrapError('create'),
    ),

  // REQUIRED: Always filter by organizationId
  findById: (ctx, id) =>
    ResultAsync.fromPromise(
      db.select()
        .from({entities}Table)
        .where(and(
          eq({entities}Table.id, id),
          eq({entities}Table.organizationId, ctx.organizationId),
          eq({entities}Table.isDeleted, false),
        ))
        .then((rows) => rows[0] ? reconstitute{Entity}(rows[0]) : null),
      wrapError('findById'),
    ),

  // REQUIRED: Count + items for pagination
  findAll: (ctx, options) =>
    ResultAsync.fromPromise(
      (async (): Promise<List{Entities}Result> => {
        const conditions: SQL[] = [
          eq({entities}Table.organizationId, ctx.organizationId),
          eq({entities}Table.isDeleted, false),
        ]

        if (options.search) {
          const escaped = options.search.replace(/[%_]/g, '\\$&')
          conditions.push(ilike({entities}Table.name, `%${escaped}%`))
        }

        if (options.status) {
          conditions.push(eq({entities}Table.status, options.status))
        }

        const whereClause = and(...conditions)

        // 1. Count FIRST (same where clause, no limit/offset)
        const [countResult] = await db
          .select({ count: count() })
          .from({entities}Table)
          .where(whereClause)

        const totalCount = countResult?.count ?? 0

        // 2. Items with pagination
        const rows = await db
          .select()
          .from({entities}Table)
          .where(whereClause)
          .orderBy({entities}Table.createdAt)
          .limit(options.limit)
          .offset(options.offset)

        return { items: rows.map(reconstitute{Entity}), totalCount }
      })(),
      wrapError('findAll'),
    ),

  existsByEmail: (ctx, email, excludeId) =>
    ResultAsync.fromPromise(
      db.select({ id: {entities}Table.id })
        .from({entities}Table)
        .where(and(
          eq({entities}Table.organizationId, ctx.organizationId),
          eq({entities}Table.email, email),
          eq({entities}Table.isDeleted, false),
          ...(excludeId ? [eq({entities}Table.id, excludeId)] : []),
        ))
        .then((rows) => rows.length > 0),
      wrapError('existsByEmail'),
    ),

  update: (ctx, id, data) =>
    ResultAsync.fromPromise(
      (async () => {
        await db
          .update({entities}Table)
          .set({ ...data, updatedAt: new Date() })
          .where(and(
            eq({entities}Table.id, id),
            eq({entities}Table.organizationId, ctx.organizationId),
          ))

        return db.select()
          .from({entities}Table)
          .where(eq({entities}Table.id, id))
          .then((rows) => rows[0] ? reconstitute{Entity}(rows[0]) : null)
      })(),
      wrapError('update'),
    ),

  softDelete: (ctx, id) =>
    ResultAsync.fromPromise(
      db.update({entities}Table)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(and(
          eq({entities}Table.id, id),
          eq({entities}Table.organizationId, ctx.organizationId),
        ))
        .then(() => undefined),
      wrapError('softDelete'),
    ),
})

// Reconstitute: map DB row → domain entity
// This ensures the domain entity is valid even when loaded from DB
function reconstitute{Entity}(row: typeof {entities}Table.$inferSelect): {Entity} {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    email: row.email,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}
```

---

## 4. Use Case (with Authorization)

Location: `{app}/use-cases/{domain}/create-{entity}.ts`

```typescript
// {app}/use-cases/{domain}/create-{entity}.ts
import { hasPermission, type Role } from '{core}/services/authorization'
import { create{Entity} } from '{core}/domain/entities/{entity}'
import type { {Entity}, {Entity}Repository } from '{core}/ports/{entity}-repository.port'
import { errAsync, type ResultAsync } from 'neverthrow'

export type Create{Entity}Input = {
  organizationId: string
  memberId: string
  memberRole: Role      // REQUIRED for authorization check
  {entity}: {
    name: string
    email: string
  }
}

export type Create{Entity}Output = {Entity}

// Error type — discriminated union with .type field
export type Create{Entity}Error =
  | { type: 'forbidden'; message: string }
  | { type: 'validation_error'; message: string }
  | { type: 'duplicate_email'; message: string }
  | { type: 'repository_error'; cause: unknown }

type Dependencies = {
  {entity}Repository: {Entity}Repository
  generateId: () => string  // REQUIRED: don't use nanoid() directly
}

export const makeCreate{Entity} =
  (deps: Dependencies) =>
  (input: Create{Entity}Input): ResultAsync<Create{Entity}Output, Create{Entity}Error> => {
    // 1. AUTHORIZATION FIRST (before any business logic)
    if (!hasPermission(input.memberRole, '{entities}:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to create {entities}',
      })
    }

    const ctx = { organizationId: input.organizationId }

    // 2. Check business rules (duplicate email)
    return deps.{entity}Repository
      .existsByEmail(ctx, input.{entity}.email)
      .mapErr((e): Create{Entity}Error => ({ type: 'repository_error', cause: e.cause }))
      .andThen((exists) => {
        if (exists) {
          return errAsync<Create{Entity}Output, Create{Entity}Error>({
            type: 'duplicate_email',
            message: 'A record with this email already exists',
          })
        }

        // 3. Create entity via DOMAIN (validates all fields)
        const {entity}Result = create{Entity}({
          id: deps.generateId(),
          organizationId: input.organizationId,
          name: input.{entity}.name,
          email: input.{entity}.email,
        })

        if ({entity}Result.isErr()) {
          return errAsync<Create{Entity}Output, Create{Entity}Error>({
            type: 'validation_error',
            message: {entity}Result.error.message,
          })
        }

        // 4. Only persist AFTER all validations pass
        return deps.{entity}Repository
          .create(ctx, {entity}Result.value)
          .mapErr((e): Create{Entity}Error => ({
            type: 'repository_error',
            cause: e.cause,
          }))
      })
  }
```

---

## 5. Contracts

Location: `{contracts}/{domain}/{entity}.ts`

```typescript
// {contracts}/{domain}/{entity}.ts
import { z } from 'zod'

// Entity schema (API representation — source of truth)
export const {entity}Schema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type {Entity} = z.infer<typeof {entity}Schema>

// Create input with validation messages (use your project's language)
export const create{Entity}InputSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name is too long'),
  email: z.string()
    .email('Invalid email format'),
})

export type Create{Entity}Input = z.infer<typeof create{Entity}InputSchema>

// Update input — partial of create + required id
export const update{Entity}InputSchema = create{Entity}InputSchema.partial().extend({
  id: z.string().min(1, 'ID is required'),
})

export type Update{Entity}Input = z.infer<typeof update{Entity}InputSchema>

// Get/Delete input
export const get{Entity}InputSchema = z.object({
  id: z.string().min(1, 'ID is required'),
})

// REQUIRED for lists: limit, offset
export const list{Entities}InputSchema = z.object({
  search: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
})

export type List{Entities}Input = z.infer<typeof list{Entities}InputSchema>

// REQUIRED for lists: items + totalCount
export const list{Entities}OutputSchema = z.object({
  items: z.array({entity}Schema),
  totalCount: z.number().int(),
})

export type List{Entities}Output = z.infer<typeof list{Entities}OutputSchema>
```

---

## 6. Procedure

Location: `{api}/procedures/{domain}/create-{entity}.ts`

```typescript
// {api}/procedures/{domain}/create-{entity}.ts
import { create{Entity}InputSchema, {entity}Schema } from '{contracts}/{domain}/{entity}'
import { makeCreate{Entity} } from '{app}/use-cases/{domain}/create-{entity}'
import { create{Entity}Repository } from '{infra}/repositories/{entity}.repository'
import { authProcedure } from '{api}/lib/orpc'

export const create{Entity} = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to create {entities}' },
    VALIDATION_ERROR: { message: 'Invalid data' },
    DUPLICATE_EMAIL: { message: 'A record with this email already exists' },
  })
  .input(create{Entity}InputSchema)
  .output({entity}Schema)
  .handler(async ({ input, context, errors }) => {
    // 1. Create repository (from context.db)
    const {entity}Repository = create{Entity}Repository(context.db)

    // 2. Create use case with dependencies
    const create{Entity}UseCase = makeCreate{Entity}({
      {entity}Repository,
      generateId,
    })

    // 3. Execute use case with context info
    const result = await create{Entity}UseCase({
      organizationId: context.organization.id,
      memberId: context.organization.memberId,
      memberRole: context.organization.role,
      {entity}: input,
    })

    // 4. Map ALL errors (exhaustive switch)
    if (result.isErr()) {
      const error = result.error
      switch (error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: error.message })
        case 'duplicate_email':
          throw errors.DUPLICATE_EMAIL()
        case 'repository_error':
          console.error('Repository error:', error.cause)
          throw new Error('Internal error')
      }
    }

    return result.value
  })
```

---

## Template Variables

When implementing a new entity, replace these placeholders:

| Placeholder | Example | Description |
|-------------|---------|-------------|
| `{Entity}` | `User`, `Product` | PascalCase entity name |
| `{entity}` | `user`, `product` | camelCase entity name |
| `{entities}` | `users`, `products` | camelCase plural |
| `{domain}` | `users`, `products` | Domain/feature folder name |
| `{core}` | `src/core`, `packages/core/src` | Core domain layer root |
| `{infra}` | `src/infrastructure`, `packages/backend/src/infrastructure` | Infrastructure layer root |
| `{app}` | `src/application`, `packages/backend/src` | Application layer root |
| `{contracts}` | `src/contracts`, `packages/contracts/src` | Contracts/schemas layer root |
| `{api}` | `src/api`, `packages/backend/src` | API/procedure layer root |
