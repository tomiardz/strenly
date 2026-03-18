# Layer Examples - Complete Code

This file contains complete, generic code examples for each layer of Clean Architecture.
Replace `{Entity}`, `{entity}`, `{entities}` with your actual entity name (e.g., User, Product, Order).

---

## 1. Domain Entity

Location: `packages/core/src/domain/entities/{entity}.ts`

```typescript
// packages/core/src/domain/entities/{entity}.ts
import { err, ok, type Result } from 'neverthrow'
import { type DomainError, validationError } from '@/core/errors'

const ENTITY = '{entity}'

// Immutable types
export type {Entity} = {
  readonly id: string
  readonly organizationId: string
  readonly name: string
  readonly email: string
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
    return err(validationError(ENTITY, 'name', 'Name is required'))
  }
  if (name.length > 100) {
    return err(validationError(ENTITY, 'name', 'Name is too long'))
  }
  return ok(name)
}

const validateEmail = (email: string): Result<string, DomainError> => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email)) {
    return err(validationError(ENTITY, 'email', 'Invalid email format'))
  }
  return ok(email)
}

// Factory function that validates - NEVER throws, returns Result
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
  })
}

// Query helpers (pure functions) - use Pick<> for minimal dependencies
export const isActive = (entity: Pick<{Entity}, 'status'>): boolean => {
  return entity.status === 'active'
}
```

---

## 2. Port

Location: `packages/core/src/ports/{entity}-repository.port.ts`

```typescript
// packages/core/src/ports/{entity}-repository.port.ts
import type { ResultAsync } from 'neverthrow'
import type { OrganizationContext, RepositoryError } from './types'

// Entity type (matches domain entity)
export type {Entity} = {
  id: string
  organizationId: string
  name: string
  email: string
  createdAt: Date
  updatedAt: Date
}

// Data for creating (without timestamps - DB handles those)
export type Create{Entity}Data = {
  id: string
  name: string
  email: string
}

// Data for updating (all optional)
export type Update{Entity}Data = Partial<Omit<Create{Entity}Data, 'id'>>

// REQUIRED: Options with limit/offset for pagination
export type List{Entities}Options = {
  search?: string
  status?: string
  limit: number   // REQUIRED - never optional
  offset: number  // REQUIRED - never optional
}

// REQUIRED: Result with totalCount for DataTable pagination
export type List{Entities}Result = {
  {entities}: {Entity}[]
  totalCount: number  // REQUIRED for frontend pagination
}

// Repository interface
export type {Entity}Repository = {
  create: (ctx: OrganizationContext, data: Create{Entity}Data)
    => ResultAsync<{Entity}, RepositoryError>

  findById: (ctx: OrganizationContext, id: string)
    => ResultAsync<{Entity} | null, RepositoryError>

  update: (ctx: OrganizationContext, id: string, data: Update{Entity}Data)
    => ResultAsync<{Entity} | null, RepositoryError>

  softDelete: (ctx: OrganizationContext, id: string)
    => ResultAsync<void, RepositoryError>

  // REQUIRED: returns { items, totalCount }
  findAll: (ctx: OrganizationContext, options: List{Entities}Options)
    => ResultAsync<List{Entities}Result, RepositoryError>

  // Existence check for uniqueness validation
  existsByEmail: (ctx: OrganizationContext, email: string, excludeId?: string)
    => ResultAsync<boolean, RepositoryError>
}
```

---

## 3. Repository

Location: `packages/backend/src/infrastructure/repositories/{entity}.repository.ts`

```typescript
// packages/backend/src/infrastructure/repositories/{entity}.repository.ts
import type { {Entity}Repository, List{Entities}Result } from '@/core/ports/{entity}-repository.port'
import type { OrganizationContext, RepositoryError } from '@/core/ports/types'
import type { DbClient } from '@/db/client'
import { {entities}Table } from '@/db/schema/{entities}'
import { and, eq, count, ilike, type SQL } from 'drizzle-orm'
import { ResultAsync } from 'neverthrow'

// Error wrapper - define at top of every repository
const wrapError = (operation: string) => (cause: unknown): RepositoryError => ({
  type: 'repository_error',
  operation,
  cause,
})

// Factory function that creates repository instance
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

        // Fetch and return created record
        const [result] = await db
          .select()
          .from({entities}Table)
          .where(eq({entities}Table.id, data.id))

        if (!result) throw new Error('Failed to fetch created record')
        return result
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
          eq({entities}Table.organizationId, ctx.organizationId),  // REQUIRED
          eq({entities}Table.isDeleted, false),
        ))
        .limit(1)
        .then((rows) => rows[0] ?? null),
      wrapError('findById'),
    ),

  // REQUIRED: Count + items for pagination
  findAll: (ctx, options) =>
    ResultAsync.fromPromise(
      (async (): Promise<List{Entities}Result> => {
        // Build conditions array
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
        const {entities} = await db
          .select()
          .from({entities}Table)
          .where(whereClause)
          .orderBy({entities}Table.createdAt)
          .limit(options.limit)
          .offset(options.offset)

        // Return BOTH items and totalCount
        return { {entities}, totalCount }
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
          excludeId ? eq({entities}Table.id, excludeId).not() : undefined,
        ))
        .limit(1)
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
          .then((rows) => rows[0] ?? null)
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
```

---

## 4. Use Case (with Authorization)

Location: `packages/backend/src/use-cases/{domain}/create-{entity}.ts`

```typescript
// packages/backend/src/use-cases/{domain}/create-{entity}.ts
import { hasPermission, type Role } from '@/core/services/authorization'
import { create{Entity} } from '@/core/domain/entities/{entity}'
import type { {Entity}, {Entity}Repository } from '@/core/ports/{entity}-repository.port'
import { errAsync, type ResultAsync } from 'neverthrow'

// Input type - includes authorization info
export type Create{Entity}Input = {
  organizationId: string
  memberId: string
  memberRole: Role      // REQUIRED for authorization check
  {entity}: {
    name: string
    email: string
  }
}

// Output type
export type Create{Entity}Output = {Entity}

// Error type - discriminated union
export type Create{Entity}Error =
  | { type: 'forbidden'; message: string }         // REQUIRED - authorization failed
  | { type: 'validation_error'; message: string }  // Domain validation failed
  | { type: 'duplicate_email'; message: string }   // Business rule violation
  | { type: 'repository_error'; cause: unknown }   // Database error

// Dependencies - inject everything, including ID generator
type Dependencies = {
  {entity}Repository: {Entity}Repository
  generateId: () => string  // REQUIRED: don't use nanoid() directly
}

/**
 * Create a new {entity} in the organization
 *
 * Authorization: Requires '{entities}:write' permission
 *
 * Flow:
 * 1. Check authorization FIRST
 * 2. Validate business rules (duplicate check)
 * 3. Create entity via domain (validates fields)
 * 4. Persist via repository
 */
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
          id: deps.generateId(),  // ID from injected dependency
          organizationId: input.organizationId,
          name: input.{entity}.name,
          email: input.{entity}.email,
        })

        // Map domain error to use case error
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

Location: `packages/contracts/src/{domain}/{entity}.ts`

```typescript
// packages/contracts/src/{domain}/{entity}.ts
import { z } from 'zod'

// Entity schema (API representation - source of truth)
export const {entity}Schema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})

export type {Entity} = z.infer<typeof {entity}Schema>

// Create input with validation messages
export const create{Entity}InputSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name is too long'),
  email: z.string()
    .email('Invalid email format'),
})

export type Create{Entity}Input = z.infer<typeof create{Entity}InputSchema>

// Update input - partial of create + required id
export const update{Entity}InputSchema = create{Entity}InputSchema.partial().extend({
  id: z.string().min(1, 'ID is required'),
})

export type Update{Entity}Input = z.infer<typeof update{Entity}InputSchema>

// Get/Delete input - just ID
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

// REQUIRED for lists: totalCount
export const list{Entities}OutputSchema = z.object({
  {entities}: z.array({entity}Schema),
  totalCount: z.number().int(),  // REQUIRED for pagination
})

export type List{Entities}Output = z.infer<typeof list{Entities}OutputSchema>
```

---

## 6. Procedure

Location: `packages/backend/src/procedures/{domain}/create-{entity}.ts`

```typescript
// packages/backend/src/procedures/{domain}/create-{entity}.ts
import { create{Entity}InputSchema, {entity}Schema } from '@/contracts/{domain}/{entity}'
import { makeCreate{Entity} } from '@/use-cases/{domain}/create-{entity}'
import { create{Entity}Repository } from '@/infrastructure/repositories/{entity}.repository'
import { authProcedure } from '@/lib/orpc'

/**
 * Create a new {entity}
 */
export const create{Entity} = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to create {entities}' },
    VALIDATION_ERROR: { message: 'Invalid data' },
    DUPLICATE_EMAIL: { message: 'A record with this email already exists' },
  })
  .input(create{Entity}InputSchema)
  .output({entity}Schema)
  .handler(async ({ input, context, errors }) => {
    // 1. Create repositories (from context.db)
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

## Stack Overview (Generic)

```
┌────────────────────────────────────────────────────────────────────┐
│ FRONTEND (apps/)                                                   │
│ - React + TanStack Router/Query                                    │
│ - Forms: React Hook Form (/form skill)                             │
│ - Tables: DataTable with server-side pagination (/data-table)      │
└────────────────────────────────────────────────────────────────────┘
                               ↕ API (oRPC/tRPC)
┌────────────────────────────────────────────────────────────────────┐
│ PROCEDURES (packages/backend/src/procedures)                       │
│ - Thin handlers - ONLY orchestration                               │
│ - Create repos → call use case → map errors                        │
│ - NO business logic                                                │
└────────────────────────────────────────────────────────────────────┘
                               ↓
┌────────────────────────────────────────────────────────────────────┐
│ USE CASES (packages/backend/src/use-cases)                         │
│ - Business logic orchestration                                     │
│ - Authorization FIRST                                              │
│ - Domain validation BEFORE persist                                 │
│ - ResultAsync for error handling                                   │
└────────────────────────────────────────────────────────────────────┘
                               ↓
┌────────────────────────────────────────────────────────────────────┐
│ REPOSITORIES (packages/backend/src/infrastructure/repositories)   │
│ - Implement Port interfaces                                        │
│ - Drizzle ORM queries                                              │
│ - ALWAYS filter by organizationId                                  │
│ - ALWAYS return totalCount for lists                               │
└────────────────────────────────────────────────────────────────────┘
                               ↓
┌────────────────────────────────────────────────────────────────────┐
│ CORE (packages/core)                                               │
│ - Domain Entities: validation, factory functions                   │
│ - Ports: repository interfaces                                     │
│ - Services: authorization (pure functions)                         │
└────────────────────────────────────────────────────────────────────┘
                               ↓
┌────────────────────────────────────────────────────────────────────┐
│ CONTRACTS (packages/contracts)                                     │
│ - Zod schemas for API boundary                                     │
│ - Shared between frontend and backend                              │
└────────────────────────────────────────────────────────────────────┘
                               ↓
┌────────────────────────────────────────────────────────────────────┐
│ DATABASE (packages/database)                                       │
│ - Drizzle schemas + migrations                                     │
└────────────────────────────────────────────────────────────────────┘
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
