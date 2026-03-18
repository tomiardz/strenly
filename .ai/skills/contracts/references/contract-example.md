# Contract Example: Workout

A complete, well-structured contract following the TRUE single source pattern.

## Architecture Overview

```
┌────────────────────────────────────────────────────────────┐
│   workoutSchema (entity)                                    │  <- TRUE Single Source
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

## Complete Example

```typescript
import { z } from 'zod'
import { idInputSchema } from '@strenly/contracts/common/id'
import { paginationQuerySchema, sortOrderSchema, PAGINATION_DEFAULTS } from '@strenly/contracts/common/pagination'
import { timestampsSchema, datetimeSchema } from '@strenly/contracts/common/dates'

// ============================================================
// ENUMS (with Spanish messages)
// ============================================================

export const workoutStatusSchema = z.enum(
  ['draft', 'scheduled', 'in_progress', 'completed', 'cancelled'],
  { errorMap: () => ({ message: 'Estado de entrenamiento invalido' }) }
)
export type WorkoutStatus = z.infer<typeof workoutStatusSchema>

export const workoutTypeSchema = z.enum(
  ['strength', 'cardio', 'flexibility', 'mixed'],
  { errorMap: () => ({ message: 'Tipo de entrenamiento invalido' }) }
)
export type WorkoutType = z.infer<typeof workoutTypeSchema>

// ============================================================
// ENTITY SCHEMA (TRUE single source - invariants + messages)
// ============================================================
// This is THE source of truth. All validation AND messages live here.
// Input schemas inherit by using .pick() - no need to redefine.

export const workoutSchema = z.object({
  // Identity
  id: z.string(),

  // Relations
  athleteId: z.string(),
  athleteName: z.string().max(200, 'El nombre del atleta no puede exceder 200 caracteres'),
  coachId: z.string(),
  coachName: z.string().max(200, 'El nombre del entrenador no puede exceder 200 caracteres'),

  // Core data WITH invariants AND Spanish messages
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
  description: z.string()
    .max(2000, 'La descripcion no puede exceder 2000 caracteres')
    .nullable(),
  type: workoutTypeSchema,
  status: workoutStatusSchema,

  // Dates
  scheduledAt: datetimeSchema.nullable(),
  startedAt: datetimeSchema.nullable(),
  completedAt: datetimeSchema.nullable(),
  durationMinutes: z.number()
    .int()
    .min(1, 'Duracion minima 1 minuto')
    .max(480, 'Duracion maxima 8 horas')
    .nullable(),

  // Timestamps
  ...timestampsSchema.shape,
})
export type Workout = z.infer<typeof workoutSchema>

// ============================================================
// INPUT SCHEMAS (just .pick() - inherit validation from entity)
// ============================================================
// DO NOT redefine validation here. Just pick the fields you need.
// Only use .extend() to ADD new fields not in entity.

// Create - picks fields from entity (validation inherited!)
export const createWorkoutInputSchema = workoutSchema
  .pick({
    name: true,
    description: true,
    type: true,
    scheduledAt: true,
    durationMinutes: true,
  })
  .extend({
    // athleteId is NOT in entity with min(1) - it's a required relation for create
    athleteId: z.string().min(1, 'Debes seleccionar un atleta'),
    // description is optional for create (entity has it as nullable)
    description: z.string()
      .max(2000, 'La descripcion no puede exceder 2000 caracteres')
      .nullish(),
    // durationMinutes is optional for create (entity has it as nullable)
    durationMinutes: z.number()
      .int()
      .min(1, 'Duracion minima 1 minuto')
      .max(480, 'Duracion maxima 8 horas')
      .nullish(),
  })
export type CreateWorkoutInput = z.infer<typeof createWorkoutInputSchema>

// Update - derive from create with .partial()
export const updateWorkoutInputSchema = createWorkoutInputSchema
  .partial()
  .extend({
    id: z.string().min(1, 'ID de entrenamiento requerido'),
    status: workoutStatusSchema.optional(),
  })
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutInputSchema>

// Get/Delete - use common idInputSchema
export const getWorkoutInputSchema = idInputSchema('entrenamiento')
export type GetWorkoutInput = z.infer<typeof getWorkoutInputSchema>

export const deleteWorkoutInputSchema = idInputSchema('entrenamiento')
export type DeleteWorkoutInput = z.infer<typeof deleteWorkoutInputSchema>

// Start/Complete - extend idInputSchema
export const startWorkoutInputSchema = idInputSchema('entrenamiento')
export type StartWorkoutInput = z.infer<typeof startWorkoutInputSchema>

export const completeWorkoutInputSchema = idInputSchema('entrenamiento').extend({
  notes: z.string().max(2000, 'Las notas no pueden exceder 2000 caracteres').nullish(),
})
export type CompleteWorkoutInput = z.infer<typeof completeWorkoutInputSchema>

// ============================================================
// OUTPUT SCHEMAS (derived from entity via pick/omit)
// ============================================================

// Full workout output (same as entity in this case)
export const workoutOutputSchema = workoutSchema
export type WorkoutOutput = z.infer<typeof workoutOutputSchema>

// List item - omit heavy fields for performance
export const workoutListItemSchema = workoutSchema.omit({ description: true })
export type WorkoutListItem = z.infer<typeof workoutListItemSchema>

// ============================================================
// LIST/SEARCH SCHEMAS
// ============================================================

export const LIST_WORKOUTS_DEFAULTS = {
  sortBy: 'scheduledAt' as const,
  sortOrder: 'desc' as const,
  limit: PAGINATION_DEFAULTS.limit,
  offset: PAGINATION_DEFAULTS.offset,
} as const

export const listWorkoutsQuerySchema = paginationQuerySchema.extend({
  athleteId: z.string().optional(),
  coachId: z.string().optional(),
  status: workoutStatusSchema.optional(),
  type: workoutTypeSchema.optional(),
  dateFrom: datetimeSchema.optional(),
  dateTo: datetimeSchema.optional(),
  search: z.string().optional(),
  sortBy: z.enum(['scheduledAt', 'createdAt', 'name']).default(LIST_WORKOUTS_DEFAULTS.sortBy),
  sortOrder: sortOrderSchema.default(LIST_WORKOUTS_DEFAULTS.sortOrder),
})
export type ListWorkoutsQuery = z.infer<typeof listWorkoutsQuerySchema>

export const listWorkoutsOutputSchema = z.object({
  items: z.array(workoutListItemSchema),
  totalCount: z.number().int(),
})
export type ListWorkoutsOutput = z.infer<typeof listWorkoutsOutputSchema>
```

## Key Patterns

### 1. Entity First WITH Invariants AND Messages (TRUE Single Source)
```typescript
// The entity defines ALL fields with validation AND Spanish messages
export const workoutSchema = z.object({
  id: z.string(),
  name: z.string()
    .min(1, 'El nombre es requerido')           // <- Message in entity
    .max(100, 'El nombre no puede exceder...'), // <- Message in entity
  durationMinutes: z.number()
    .int()
    .min(1, 'Duracion minima 1 minuto')         // <- Message in entity
    .max(480, 'Duracion maxima 8 horas')        // <- Message in entity
    .nullable(),
})
export type Workout = z.infer<typeof workoutSchema>
```

### 2. Input Derives from Entity via .pick() Only
```typescript
// Just pick fields - validation AND messages are inherited!
export const createWorkoutInputSchema = workoutSchema
  .pick({ name: true, type: true })
// NO need to .extend() to add messages - they're already in entity!

// Only use .extend() to ADD new fields not in entity:
export const createWorkoutInputSchema = workoutSchema
  .pick({ name: true, type: true })
  .extend({
    athleteId: z.string().min(1, 'Selecciona un atleta'), // NEW field
  })
```

### 3. Output via Pick/Omit (Inherits Everything)
```typescript
// Full output = entity (inherits all validation)
export const workoutOutputSchema = workoutSchema

// List item = entity minus heavy fields
export const workoutListItemSchema = workoutSchema.omit({ description: true })

// Partial output = only specific fields
export const workoutSummarySchema = workoutSchema.pick({
  id: true,
  name: true,
  status: true
})
```

### 4. Update from Create with Partial
```typescript
export const updateWorkoutInputSchema = createWorkoutInputSchema
  .partial()
  .extend({ id: z.string().min(1, 'ID requerido') })
```

## Common Mistakes

```typescript
// BAD: Entity without messages (old pattern)
export const workoutSchema = z.object({
  name: z.string().max(100),  // NO message - WRONG!
})
// Then input redefines EVERYTHING with messages - WRONG!
export const createInputSchema = workoutSchema.pick({ name: true }).extend({
  name: z.string().min(1, 'Requerido').max(100, 'Muy largo'),  // WRONG!
})

// GOOD: Entity WITH messages (new pattern)
export const workoutSchema = z.object({
  name: z.string()
    .min(1, 'El nombre es requerido')
    .max(100, 'El nombre no puede exceder 100 caracteres'),
})
// Input just picks - messages inherited!
export const createInputSchema = workoutSchema.pick({ name: true })


// BAD: Duplicating entity fields in output
export const workoutOutputSchema = z.object({
  id: z.string(),
  name: z.string(),
  // ... copy-paste of entity
})

// GOOD: Derive from entity
export const workoutOutputSchema = workoutSchema
export const workoutListItemSchema = workoutSchema.omit({ description: true })
```

## When to Use .extend()

**ONLY to add fields that DON'T exist in the entity:**

```typescript
// Entity doesn't have athleteId with min(1) constraint
// It's a create-only required field
const createInputSchema = entitySchema
  .pick({ name: true })
  .extend({
    athleteId: z.string().min(1, 'Selecciona un atleta'), // NEW field
  })
```

**DO NOT use .extend() just to add messages:**

```typescript
// WRONG - entity field with message re-added
const createInputSchema = entitySchema.pick({ name: true }).extend({
  name: z.string().min(1, 'Requerido').max(100, 'Muy largo'),  // WRONG!
})

// CORRECT - message is already in entity, just pick
const createInputSchema = entitySchema.pick({ name: true })
```

## Validation Philosophy

**TRUE Single Source (Entity):**
- Business invariants (max lengths, valid ranges, formats)
- Spanish error messages for user feedback
- Defined ONCE, inherited everywhere

**Input Schemas:**
- Just `.pick()` fields from entity
- Only `.extend()` to ADD new fields
- DO NOT redefine validation or messages

This gives you:
- **Single source of truth** for ALL validation
- **No duplication** of messages across operations
- **Automatic consistency** - change entity, inputs update automatically

## Nullability Guidelines

| Context | Modifier | Example |
|---------|----------|---------|
| Entity fields | `.nullable()` | `description: z.string().max(2000).nullable()` |
| Input optional | `.nullish()` | `description: z.string().max(2000).nullish()` |
| Output from entity | `.nullable()` (inherited) | via `.pick()`/`.omit()` |
