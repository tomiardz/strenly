---
name: domain
description: >-
  DDD building blocks: Value Objects, Entities, and Aggregates with neverthrow Result pattern.
  Use this skill when creating or modifying domain concepts in the core layer — modeling entities
  with factory functions, defining value objects, or establishing aggregate boundaries. Also use
  when reviewing domain code for DDD violations (missing validation, mutable state, ID generation
  in domain). Do NOT load for DTOs, API response types, database models, or infrastructure concerns.
scope: ["clean-architecture"]
---

# Domain Building Blocks

Creates domain building blocks that encapsulate business logic following DDD principles. Every domain type is immutable, self-validating, and returns `Result<T, Error>` via neverthrow — never throws.

> **Stack:** neverthrow for Result types. Projects map path placeholders (`{core}`, etc.) to their directory structure in CLAUDE.md.

## Decision Flowchart

Before writing code, classify the concept:

```
Does the concept need a unique identity?
├── NO → Does it have validation rules?
│         ├── YES → VALUE OBJECT (e.g., Email, Money, DateRange)
│         └── NO  → Plain type or enum (e.g., status literals)
│
└── YES → Can it exist independently?
          ├── NO  → CHILD ENTITY owned by Aggregate (e.g., OrderItem)
          └── YES → Is it a consistency boundary?
                    ├── YES → AGGREGATE ROOT (e.g., Order with OrderItems)
                    └── NO  → STANDALONE ENTITY (e.g., Customer, Product)
```

| If the concept... | It's a... |
|-------------------|-----------|
| Has no ID, compared by attributes | Value Object |
| Has ID, can be referenced directly | Entity |
| Has ID, owns other entities, enforces invariants | Aggregate Root |
| Has ID, lives inside an aggregate | Child Entity |

## Location

```
{core}/domain/
├── value-objects/           # Value Objects (no identity)
│   ├── email.ts
│   ├── money.ts
│   └── date-range.ts
├── entities/                # Entities and Aggregates
│   ├── customer.ts          # Standalone Entity
│   ├── order.ts             # Aggregate Root (owns OrderItems)
│   └── order-item.ts        # Child Entity (owned by Order)
└── errors/
    └── domain-errors.ts     # Shared domain error types
```

## Value Objects

Value Objects have **no identity** — defined entirely by their attributes. Two VOs with the same attributes are equal.

**Rules:**
- No `id` field — ever
- All properties `readonly`
- Self-validating: factory returns `Result<VO, VOError>` (or type guard for constrained types)
- Immutable: operations return new instances
- Pure: no side effects

**Two patterns exist:**

1. **Constrained Type** — fixed set of values with optional derived behavior (e.g., status enums, muscle groups, movement patterns). Use `as const` array + type guard.
2. **Validated Type** — complex rules beyond type checking (e.g., Email, Money, DateRange). Use factory function returning `Result`.

**When NOT to create a VO:** If it's a simple type alias with no validation or derived behavior, just use a type literal (e.g., `type Priority = 'low' | 'medium' | 'high'`).

For complete patterns and examples, see `references/value-object-examples.md`.

## Entities

Entities have **identity** that persists across time. Same ID = same entity, regardless of attribute changes.

**Rules:**
- Always have a unique `id: string` field
- All properties `readonly`
- Factory function `create{Entity}(input)` returns `Result<Entity, EntityError>`
- **ID is received as input** — the domain does NOT generate IDs (infrastructure concern; use case injects `generateId`)
- Provide `reconstitute{Entity}(props)` for loading from DB (skips validation — data is already valid)
- Query helpers use `Pick<Entity, 'field1' | 'field2'>` for minimal dependencies

**Common patterns:**

1. **Standard Entity** — identity, validation, lifecycle (Customer, Product)
2. **Entity with State Machine** — valid transitions map, semantic transition helpers (Order statuses)
3. **Entity with Computed State** — state derived from data, not stored (Subscription: trial/active/expired)
4. **Entity with Mutation Helpers** — multiple validated update operations (updatePrice, addStock)
5. **Entity with Update Function** — partial updates with per-field validation (`updateEntity(entity, updates)`)

**Key: Update operations must re-validate through the domain.** Don't bypass the factory — fetch existing entity, apply changes, validate via domain, then persist.

For complete patterns and examples, see `references/entity-examples.md`.

## Aggregates

Aggregates are clusters of Entities and Value Objects treated as a **single unit** for data changes. The Aggregate Root is the only entry point.

**Rules:**
- All invariants within the aggregate are enforced together
- Only the root can be accessed from outside
- Saved/loaded as a complete unit (single repository call, single transaction)
- Children cannot exist without the root
- Child entity IDs are local to the aggregate

**Identifying boundaries — ask:** "If I delete X, what else MUST be deleted?"
- Delete an Order → Delete its OrderItems (**aggregate** — owned)
- Delete a Customer → Orders remain (**separate** — referenced)

**Common patterns:**

1. **Simple Aggregate** — root with child entities (Order → OrderItems)
2. **Nested Aggregate** — multiple levels (Document → Chapters → Sections)
3. **Cross-child Invariants** — rules that span children (ShoppingCart total quantity limit)

**Repository pattern for aggregates:**
```typescript
export interface OrderRepository {
  findById(ctx: Context, id: string): ResultAsync<Order | null, RepositoryError>
  save(ctx: Context, order: Order): ResultAsync<void, RepositoryError>
}
```
The repository persists all child entities in a single transaction. The domain doesn't know about database structure.

For complete patterns and examples, see `references/aggregate-examples.md`.

## Quick Reference Templates

### Value Object (Constrained)
```typescript
export const VALUES = ['a', 'b', 'c'] as const
export type MyVO = (typeof VALUES)[number]
export function isValid(value: unknown): value is MyVO {
  return typeof value === 'string' && VALUES.includes(value as MyVO)
}
```

### Value Object (Validated)
```typescript
export type MyVO = { readonly field: string }
export type MyVOError = { type: 'INVALID_FIELD'; message: string }
export function createMyVO(input: string): Result<MyVO, MyVOError> { /* validate */ }
```

### Entity
```typescript
export type MyEntity = {
  readonly id: string
  readonly organizationId: string
  readonly createdAt: Date
  readonly updatedAt: Date
}
export function createMyEntity(input: CreateInput): Result<MyEntity, MyEntityError> { /* validate */ }
export function reconstituteMyEntity(props: MyEntity): MyEntity { return { ...props } }
```

### Aggregate Root
```typescript
export type MyAggregate = {
  readonly id: string
  readonly children: readonly ChildEntity[]
}
export function addChild(root: MyAggregate, child: Child): Result<MyAggregate, Error> { /* invariants */ }
export function removeChild(root: MyAggregate, childId: string): Result<MyAggregate, Error> { /* validate */ }
```

## Common Violations

**1. Generating IDs in the domain**
```typescript
// WRONG — ID generation is infrastructure
export function createEntity(input) {
  return ok({ id: nanoid(), ...input })
}

// CORRECT — ID comes from use case
export function createEntity(input: { id: string; ... }) {
  return ok({ id: input.id, ...input })
}
```

**2. Mutable properties**
```typescript
// WRONG — allows mutation
export type Entity = { name: string }

// CORRECT — immutable
export type Entity = { readonly name: string }
```

**3. Throwing instead of returning Result**
```typescript
// WRONG — throws
if (!name) throw new Error('Name required')

// CORRECT — returns Result
if (!name) return err({ type: 'NAME_REQUIRED', message: 'Name is required' })
```

**4. Skipping domain validation on updates**
```typescript
// WRONG — bypass domain
return deps.repository.update(ctx, id, changes)

// CORRECT — re-validate through domain
const entityResult = createEntity({ ...existing, ...changes })
```

## Success Criteria

### Value Object
- [ ] No `id` field
- [ ] All properties `readonly`
- [ ] Factory returns `Result<VO, VOError>` (or type guard for constrained types)
- [ ] Provides equality comparison if needed
- [ ] Pure functions only (no side effects)

### Entity
- [ ] Has unique `id` field
- [ ] ID received as input (not generated in domain)
- [ ] All properties `readonly`
- [ ] Factory returns `Result<Entity, EntityError>`
- [ ] Provides `reconstitute` function for loading from DB
- [ ] Query helpers use `Pick<>` for minimal requirements

### Aggregate Root
- [ ] Owns child entities (children reference parent via ID)
- [ ] All modifications go through root
- [ ] Enforces cross-entity invariants
- [ ] Loaded/saved as a complete unit
- [ ] Children cannot be referenced from outside aggregate

## Cross-References

| Layer | Skill | Relationship |
|-------|-------|-------------|
| Architecture | `/clean-architecture` | Defines the full inside-out pipeline — domain is step 1 |
| Port | `/port` | Repository interfaces that consume domain entities |
| Repository | `/repository` | Drizzle implementations that persist and reconstitute entities |
| Use Case | `/use-case` | Orchestrates domain validation — calls factory before persist |

## Resources

For complete implementations with multiple patterns each, read the relevant reference file:

- **Value Objects**: `references/value-object-examples.md` — constrained types, validated types, composite VOs, ranges, string parsing, embedded VOs
- **Entities**: `references/entity-examples.md` — standard, state machine, computed state, mutation helpers, optional fields, ID generation
- **Aggregates**: `references/aggregate-examples.md` — simple children, nested levels, cross-child invariants, repository pattern, boundary guidelines
