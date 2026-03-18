---
name: contracts
description: |
  Provides guidelines for creating shared Zod 4 schemas (contracts) in src/contracts.
  Contracts define the API boundary between frontend and backend, ensuring type safety and validation.
  Use this skill when creating new procedures, forms, or API endpoints that need input/output schemas.
  Do NOT load for runtime validation, frontend-only local state, or database schema definitions.
---

<objective>
Creates shared Zod 4 schemas that define the data structures exchanged between frontend and backend. Entity schemas are the TRUE single source of truth - they contain ALL validation rules INCLUDING Spanish error messages. Input schemas just use `.pick()` to select fields.
</objective>

<quick_start>
1. Create file at `src/contracts/{domain}/{resource}.ts`
2. Define entity schema first - **WITH invariants AND Spanish messages** (true single source)
3. Define input schemas using `.pick()` only - they inherit validation from entity
4. Only use `.extend()` to ADD new fields not in entity (like `owners` array)
5. **ALWAYS include `limit`/`offset` in list input and `totalCount` in list output**
</quick_start>

<architecture>
```
┌────────────────────────────────────────────────────────────┐
│   {resource}Schema (entity)                                 │  ← TRUE Single Source
│   - Business invariants (max lengths, ranges, formats)      │
│   - Spanish error messages                                  │
│   - ALL validation lives here                               │
└────────────────────────────────────────────────────────────┘
         ↓ .pick() only (NO .extend() for messages)
┌─────────────────────────┐  ┌─────────────────┐
│    Input Schemas        │  │ Output Schemas  │
│ .pick() from entity     │  │ .pick()/.omit() │
│ (inherit validation)    │  │ from entity     │
└─────────────────────────┘  └─────────────────┘
```

**Key Principle:**
- Entity schema = **TRUE single source of truth** (invariants + messages)
- Input schemas = `.pick()` only (inherit everything from entity)
- Only use `.extend()` to ADD new fields that don't exist in entity
</architecture>

<critical_rule>
**MUST NOT redefine validation in input schemas**

```typescript
// WRONG - redefining validation in input schema
const createInputSchema = entitySchema.pick({ name: true }).extend({
  name: z.string().min(1, 'Requerido').max(200, 'Máximo 200'),  // WRONG!
})

// CORRECT - entity has all validation, input just picks
const entitySchema = z.object({
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
})
const createInputSchema = entitySchema.pick({ name: true })  // Just pick!
```

**When to use `.extend()`:**
ONLY to add fields that don't exist in the entity schema:
```typescript
// Entity doesn't have owners - it's a create-only concept
const createAccountInputSchema = accountSchema
  .pick({ name: true, institution: true })
  .extend({
    owners: ownershipArraySchema,  // NEW field, not in entity
  })
```
</critical_rule>

<file_structure>
```
src/contracts/
├── common/             # Reusable schemas (pagination, timestamps, amounts, etc.)
│   ├── pagination.ts
│   ├── dates.ts
│   ├── email.ts
│   ├── id.ts
│   └── amount.ts       # Currency amount schemas (up to 6 decimals)
├── taxpayer/
│   └── taxpayer.ts
├── movement/
│   └── movement.ts
├── auth/
│   ├── login.ts
│   └── signup.ts
└── {domain}/
    └── {resource}.ts
```
</file_structure>

<naming_conventions>
| Type | Naming | Purpose |
|------|--------|---------|
| Enum | `{name}Schema` | Fixed values (roles, status) |
| **Entity** | `{resource}Schema` | TRUE single source (invariants + messages) |
| Create Input | `create{Resource}InputSchema` | Create operation (`.pick()` from entity) |
| Update Input | `update{Resource}InputSchema` | Update operation (`.partial()` from create) |
| Get/Delete Input | `get{Resource}InputSchema` | Single item operations |
| **Output** | `{resource}OutputSchema` | API response (same as entity or `.pick()`) |
| List Item | `{resource}ListItemSchema` | Lighter version for lists |
| List Query | `list{Resources}QuerySchema` | Paginated list params |
| List Output | `list{Resources}OutputSchema` | Paginated list response |
</naming_conventions>

<contract_template>
```typescript
import { z } from 'zod'
import { idInputSchema } from '@/contracts/common/id'
import { timestampsSchema } from '@/contracts/common/dates'

// ============================================================
// ENUMS
// ============================================================

export const statusSchema = z.enum(['active', 'inactive'])
export type Status = z.infer<typeof statusSchema>

// ============================================================
// ENTITY SCHEMA (TRUE single source - invariants + messages)
// ============================================================
// This is THE source of truth. All validation AND messages live here.
// Input schemas inherit by using .pick() - no need to redefine.

export const taxpayerSchema = z.object({
  // Identity
  id: z.string(),
  organizationId: z.string(),

  // Core data - invariants WITH Spanish messages
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(200, 'El nombre no puede exceder 200 caracteres'),
  currentPeriod: z.enum(['2024', '2025', '2026'], {
    errorMap: () => ({ message: 'Periodo fiscal inválido' }),
  }),
  status: statusSchema,

  // Timestamps
  ...timestampsSchema.shape,
})
export type Taxpayer = z.infer<typeof taxpayerSchema>

// ============================================================
// INPUT SCHEMAS (just .pick() - inherit validation from entity)
// ============================================================
// DO NOT redefine validation here. Just pick the fields you need.
// Only use .extend() to ADD new fields not in entity.

// Create - picks fields from entity (validation inherited!)
export const createTaxpayerInputSchema = taxpayerSchema.pick({
  name: true,
  currentPeriod: true,
})
export type CreateTaxpayerInput = z.infer<typeof createTaxpayerInputSchema>

// Update - partial of create + id
export const updateTaxpayerInputSchema = createTaxpayerInputSchema
  .partial()
  .extend({
    id: z.string().min(1, 'ID de contribuyente requerido'),
  })
export type UpdateTaxpayerInput = z.infer<typeof updateTaxpayerInputSchema>

// Get/Delete - use common idInputSchema
export const getTaxpayerInputSchema = idInputSchema('contribuyente')
export type GetTaxpayerInput = z.infer<typeof getTaxpayerInputSchema>

// ============================================================
// OUTPUT SCHEMAS (derived from entity)
// ============================================================

export const taxpayerOutputSchema = taxpayerSchema
export type TaxpayerOutput = z.infer<typeof taxpayerOutputSchema>

// ============================================================
// LIST/SEARCH SCHEMAS (PAGINATION REQUIRED)
// ============================================================

export const LIST_TAXPAYERS_DEFAULTS = {
  limit: 10,
  maxLimit: 100,
} as const

export const listTaxpayersInputSchema = z.object({
  search: z.string().optional(),
  status: statusSchema.optional(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
})
export type ListTaxpayersInput = z.infer<typeof listTaxpayersInputSchema>

export const listTaxpayersOutputSchema = z.object({
  items: z.array(taxpayerSchema),
  totalCount: z.number().int(),
})
export type ListTaxpayersOutput = z.infer<typeof listTaxpayersOutputSchema>
```
</contract_template>

<common_schemas>
**Common schemas have Spanish messages built-in:**

```typescript
import { currencyAmountSchema } from '@/contracts/common/amount'
import { dateOnlySchema } from '@/contracts/common/dates'
import { emailSchema } from '@/contracts/common/email'

// Use directly in entity - messages are included
const entitySchema = z.object({
  balance: currencyAmountSchema,      // 'Monto invalido (hasta 6 decimales)'
  acquisitionDate: dateOnlySchema,    // 'Fecha invalida (YYYY-MM-DD)'
  email: emailSchema,                 // 'Email invalido'
})
```

**Available common schemas:**

| Schema | Purpose | Message |
|--------|---------|---------|
| `currencyAmountSchema` | Financial amounts (±, 6 decimals) | 'Monto invalido (hasta 6 decimales)' |
| `positiveCurrencyAmountSchema` | Positive amounts only | 'Monto invalido (debe ser positivo)' |
| `dateOnlySchema` | Business dates (YYYY-MM-DD) | 'Fecha invalida (YYYY-MM-DD)' |
| `datetimeSchema` | Timestamps | Coerced Date object |
| `emailSchema` | Email addresses | 'Email invalido' |
</common_schemas>

<error_messages>
All validation messages in **Spanish** using **string format**:

```typescript
// Correct - string format
z.string().min(1, 'El nombre es requerido')
z.string().email('Email inválido')
z.number().min(0, 'Debe ser mayor o igual a 0')

// For enums, use errorMap
z.enum(['active', 'inactive'], {
  errorMap: () => ({ message: 'Estado inválido' }),
})
```
</error_messages>

<nullability_guidelines>
| Context | Modifier | Example |
|---------|----------|---------|
| Optional in entity | `.nullable()` | `description: z.string().max(500).nullable()` |
| Optional in input | `.optional()` or `.nullish()` | `.partial()` makes all optional |
| Never null | No modifier | `name: z.string().min(1, '...')` |
</nullability_guidelines>

<date_fields>
```typescript
import { datetimeSchema, dateOnlySchema, timestampsSchema } from '@/contracts/common/dates'

export const entitySchema = z.object({
  birthDate: dateOnlySchema.nullable(),    // "2024-01-15" string
  scheduledAt: datetimeSchema.nullable(),  // Date object
  ...timestampsSchema.shape,               // createdAt, updatedAt
})
```
</date_fields>

<pagination_requirements>
**ALL list endpoints MUST support pagination.**

**Input:**
```typescript
export const listResourcesInputSchema = z.object({
  search: z.string().optional(),
  limit: z.number().int().min(1).max(100).default(10),
  offset: z.number().int().min(0).default(0),
})
```

**Output:**
```typescript
export const listResourcesOutputSchema = z.object({
  items: z.array(resourceSchema),
  totalCount: z.number().int(),
})
```
</pagination_requirements>

<imports_pattern>
Always import from specific file path:

```typescript
// Correct
import { taxpayerSchema, createTaxpayerInputSchema } from '@/contracts/taxpayer/taxpayer'
import { currencyAmountSchema } from '@/contracts/common/amount'

// Wrong - barrel imports
import { taxpayerSchema } from '@/contracts'
```
</imports_pattern>

<success_criteria>
When creating a new contract:

- [ ] Create file at `src/contracts/{domain}/{resource}.ts`
- [ ] **Entity schema has ALL validation WITH Spanish messages**
- [ ] **Input schemas use `.pick()` only - NO redefining validation**
- [ ] Only use `.extend()` to ADD new fields not in entity
- [ ] Update schema uses `.partial()` from create
- [ ] Output schemas derive from entity
- [ ] List input has `limit` and `offset`
- [ ] List output has `items` and `totalCount`
- [ ] Export TypeScript types for all schemas
</success_criteria>

<resources>
- `references/contract-example.md` - Complete example with correct pattern
- `common/` schemas - Reusable schemas with Spanish messages
</resources>
