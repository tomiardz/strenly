# Schema Derivation from Contracts

Form schemas MUST be derived from contracts, NOT redefined inline. Contracts are the single source of truth for validation logic.

## Why Contract-First?

- **Single source of truth** — Validation logic lives in one place
- **Automatic propagation** — Changes to contracts update all forms
- **API consistency** — Form and API validation guaranteed to match
- **Consistent messages** — Error messages consistent everywhere

## Patterns

### Pick Fields from Contract

When form needs a subset of contract fields:

```tsx
import { create{Entity}InputSchema } from '{contracts}/{entity}/create-{entity}'

// CORRECT — derive from contract
const formSchema = create{Entity}InputSchema.pick({
  name: true,
  category: true,
})

// WRONG — duplicate validation
const formSchema = z.object({
  name: z.string().min(1, 'Required'),  // Duplicates contract!
  category: z.string(),
})
```

### Omit Fields Not in Form

When form doesn't need certain fields (e.g., IDs from route/context):

```tsx
import { create{Entity}InputSchema } from '{contracts}/{entity}/create-{entity}'

// Form doesn't need organizationId (comes from context) or entityId (from route params)
const formSchema = create{Entity}InputSchema.omit({ organizationId: true, entityId: true })
```

### Extend for UI-Only Fields

When form needs extra fields for display that aren't sent to API:

```tsx
import { positionInputSchema } from '{contracts}/{entity}/update-{entity}'

// Add display-only field for UI
const formPositionSchema = positionInputSchema.extend({
  displayName: z.string().optional(), // UI display only, stripped before API call
})
```

### Compose from Multiple Contracts

When form combines schemas from different contracts:

```tsx
import {
  sectionAInputSchema,
  sectionBInputSchema,
} from '{contracts}/{entity}/update-{entity}'

const formSchema = z.object({
  sectionA: sectionAInputSchema,
  sectionBItems: z.array(sectionBInputSchema.extend({
    displayLabel: z.string().optional(), // UI-only
  })),
  markComplete: z.boolean(), // Form-specific field
})
```

### Partial for Edit Forms

When edit form makes all fields optional:

```tsx
import { create{Entity}InputSchema } from '{contracts}/{entity}/create-{entity}'

// Edit form — all fields optional
const editFormSchema = create{Entity}InputSchema.partial()

// Edit form — some fields required
const editFormSchema = create{Entity}InputSchema.partial().required({
  name: true,
})
```

## Common Mistakes

### Redefining Validation

```tsx
// BAD — duplicates contract validation
const formSchema = z.object({
  amount: z.string().optional().refine(
    (val) => !val || /^-?\d+(\.\d{1,2})?$/.test(val),
    { message: 'Enter a valid number' }
  ),
})

// GOOD — derive from contract
import { updateInputSchema } from '{contracts}/{entity}/update-{entity}'
const formSchema = updateInputSchema.omit({ entityId: true })
```

### Different Validation Rules

```tsx
// BAD — form has different regex than contract
const formSchema = z.object({
  amount: z.string().regex(/^\d+$/, 'Numbers only'), // Different from contract!
})

// GOOD — use contract's validation
import { amountInputSchema } from '{contracts}/common/amount'
const formSchema = z.object({
  amount: amountInputSchema,
})
```

### Forgetting UI-Only Fields

```tsx
// When form needs display data not in contract
const formSchema = contractSchema.extend({
  // Explicitly mark UI-only fields
  displayLabel: z.string().optional(),  // For select display
  _tempId: z.string().optional(),       // For field arrays
})

// Strip before sending to API
const { displayLabel, _tempId, ...apiData } = formData
```

## When No Contract Exists

If form is purely frontend (no API call), define schema locally. But if form submits to API:

1. First check if a contract exists in `{contracts}/`
2. If not, consider if one should be created (use `/contracts` skill)
3. Only define locally if truly form-specific with no API equivalent
