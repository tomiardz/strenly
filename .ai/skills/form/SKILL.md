---
name: form
description: >-
  React Hook Form + shadcn/ui Field component patterns for forms with validation.
  Use this skill when creating forms, refactoring existing forms to use the Field pattern,
  or working with controlled components (Select, Checkbox, Combobox) and field arrays.
  Triggers on: form creation, field validation, zodResolver, useForm, Controller pattern,
  form refactoring, React Hook Form, shadcn Field, edit form, create form, form schema,
  form with select, form with combobox, field arrays, form dialog.
  Do NOT load for general React questions, state management, or non-form UI components.
scope: ["ui"]
---

# Form

Creates forms using React Hook Form + shadcn/ui Field components. Forms are pure UI components that receive callbacks from parents — they never contain mutations. ALL fields use Controller — never use `register()`.

## Core Rules

### 1. Forms Are Pure UI

Forms NEVER contain mutations. They receive callbacks from parent.

```tsx
// CORRECT
type FormProps = {
  onSubmit: (data: FormData) => void
  onCancel?: () => void
  isSubmitting?: boolean
  defaultValues?: Partial<FormData>
}

function ResourceForm({ onSubmit, isSubmitting }: FormProps) {
  // Form handles UI/validation only
}

// WRONG — mutation inside form
function BadForm() {
  const mutation = useMutation({ ... }) // NO!
}
```

### 2. Use zodResolver (Zod 4 Compatible)

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'

const { control, handleSubmit } = useForm({
  resolver: zodResolver(schema),
  defaultValues: { ... },
})
```

> **Fallback**: If you encounter edge cases where `zodResolver` doesn't work with Zod 4, use `standardSchemaResolver` from `@hookform/resolvers/standard-schema` as a fallback.

### 3. ALWAYS Use Controller — Never use register()

The shadcn/ui pattern uses `Controller` for ALL fields. This provides access to `fieldState` for proper error styling on the `Field` component.

```tsx
// CORRECT — Controller pattern
<Controller
  name="fieldName"
  control={control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="fieldName">Label</FieldLabel>
      <FieldContent>
        <Input id="fieldName" {...field} />
        <FieldDescription>Optional help text</FieldDescription>
        <FieldError errors={[fieldState.error]} />
      </FieldContent>
    </Field>
  )}
/>

// WRONG — register pattern (do NOT use)
<Field>
  <Input {...register('fieldName')} /> {/* NO! */}
</Field>
```

### 4. Derive Form Schemas from Contracts

Form schemas MUST derive from contracts using `.pick()`, `.omit()`, or `.extend()`. NEVER redefine validation inline.

```tsx
// CORRECT — derive from contract
import { create{Entity}InputSchema } from '{contracts}/{entity}/create-{entity}'
const formSchema = create{Entity}InputSchema.omit({ organizationId: true })

// WRONG — duplicates contract validation
const formSchema = z.object({
  name: z.string().min(1, 'Required'),  // Duplicated!
})
```

See `references/schema-derivation.md` for complete patterns.

### 5. Submit Data Types MUST Use Contract Types

Never define custom submit data interfaces. Use contract types directly or extend them:

```tsx
// CORRECT — use contract type directly
import type { Update{Entity}Input } from '{contracts}/{entity}/update-{entity}'

type FormProps = {
  onSubmit: (data: Update{Entity}Input) => void
}

// CORRECT — extend contract type for UI-only fields
import type { PositionInput } from '{contracts}/{entity}/update-{entity}'
type FormValue = PositionInput & { displayName?: string }  // UI-only field

// WRONG — custom interface duplicating contract structure
interface MyFormSubmitData {
  entityId: string
  position?: { ... }  // Duplicates contract!
}
```

## Form Template

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import type { z } from 'zod'
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

// Derive from contract (see /contracts skill)
import { create{Entity}InputSchema } from '{contracts}/{entity}/create-{entity}'
const formSchema = create{Entity}InputSchema.omit({ organizationId: true })

type FormData = z.infer<typeof formSchema>

type Props = {
  id?: string
  onSubmit: (data: FormData) => void
  onCancel?: () => void
  isSubmitting?: boolean
  defaultValues?: Partial<FormData>
}

export function {Entity}Form({
  id,
  onSubmit,
  onCancel,
  isSubmitting = false,
  defaultValues,
}: Props) {
  const { control, handleSubmit } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues,
  })

  return (
    <form id={id} onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      <fieldset disabled={isSubmitting} className="flex flex-col gap-4">
        <Controller
          name="name"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="name">
                Name <span className="text-destructive">*</span>
              </FieldLabel>
              <FieldContent>
                <Input id="name" placeholder="Enter name" {...field} />
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />

        <Controller
          name="email"
          control={control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <FieldContent>
                <Input id="email" type="email" placeholder="user@example.com" {...field} />
                <FieldDescription>Used for notifications</FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </FieldContent>
            </Field>
          )}
        />
      </fieldset>

      <div className="flex gap-2 justify-end">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </form>
  )
}
```

## Parent Mutation Usage

Parent component owns the mutation — form receives callbacks:

```tsx
function Create{Entity}Dialog({ open, onOpenChange }: Props) {
  const mutation = useMutation({
    mutationFn: orpc.{entities}.create.mutate,
    onSuccess: () => {
      toast.success('{Entity} created')
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <{Entity}Form
          onSubmit={(data) => mutation.mutate(data)}
          onCancel={() => onOpenChange(false)}
          isSubmitting={mutation.isPending}
        />
      </DialogContent>
    </Dialog>
  )
}
```

## Create/Edit Mode Pattern

Use discriminated union props to handle create vs edit in a single component. Pass `defaultValues` as a prop — React Hook Form initializes from it. When the parent needs to switch entities, **remount the form via `key`** instead of using `useEffect` + `reset()`:

```tsx
type Create{Entity}FormProps = {
  mode: 'create'
  onSubmit: (data: Create{Entity}Input) => void
  isSubmitting?: boolean
}

type Edit{Entity}FormProps = {
  mode: 'edit'
  defaultValues: {Entity}
  onSubmit: (data: Update{Entity}Input) => void
  isSubmitting?: boolean
}

type {Entity}FormProps = Create{Entity}FormProps | Edit{Entity}FormProps

export function {Entity}Form(props: {Entity}FormProps) {
  const schema = props.mode === 'create' ? createSchema : updateSchema

  const { control, handleSubmit } = useForm({
    resolver: zodResolver(schema),
    defaultValues: props.mode === 'edit' ? props.defaultValues : undefined,
  })

  return <form onSubmit={handleSubmit(props.onSubmit)}>{/* ... */}</form>
}

// Parent remounts form when switching entities — no useEffect/reset needed
<{Entity}Form key={entity.id} mode="edit" defaultValues={entity} onSubmit={handleUpdate} />
```

## Controlled Components

Every controlled component follows the same Controller wrapper — only the inner component changes. Here's a Select example showing the full pattern:

```tsx
<Controller
  name="role"
  control={control}
  render={({ field, fieldState }) => (
    <Field data-invalid={fieldState.invalid}>
      <FieldLabel htmlFor="role">Role</FieldLabel>
      <FieldContent>
        <Select value={field.value ?? ''} onValueChange={field.onChange}>
          <SelectTrigger id="role">
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <FieldError errors={[fieldState.error]} />
      </FieldContent>
    </Field>
  )}
/>
```

For other components, only the inner element changes:

| Component | Value binding | Change binding | Notes |
|-----------|--------------|----------------|-------|
| `Input` | `{...field}` | (included in spread) | Simplest — just spread `field` |
| `Textarea` | `{...field}` | (included in spread) | Add `rows={4}` for height |
| `Select` | `value={field.value ?? ''}` | `onValueChange={field.onChange}` | Radix Select — needs explicit value/onChange |
| `Checkbox` | `checked={field.value}` | `onCheckedChange={field.onChange}` | Wrap label in `flex items-center gap-2` |
| `DatePicker` | `value={field.value}` | `onChange={field.onChange}` | Project's DatePicker component |
| `Combobox` | `value={field.value ?? ''}` | `onValueChange={field.onChange}` | Client-side searchable dropdown |
| `ServerCombobox` | `value={field.value ?? ''}` | `onValueChange={field.onChange}` | Add `onSearchChange`, `onEndReached`, `isLoading` |

### ServerCombobox (Paginated Search)

ServerCombobox needs extra state for debounced search and infinite scroll:

```tsx
const [search, setSearch] = useState('')
const query = orpc.{entities}.list.useInfiniteQuery({
  input: { search, limit: 20 },
  getNextPageParam: (lastPage) => lastPage.nextCursor,
})

const options = query.data?.pages
  .flatMap((page) => page.items)
  .map((item) => ({ value: item.id, label: item.name })) ?? []

// Inside Controller render — pass extra props to ServerCombobox:
<ServerCombobox
  options={options}
  value={field.value ?? ''}
  onValueChange={field.onChange}
  onSearchChange={setSearch}
  onEndReached={() => query.fetchNextPage()}
  isLoading={query.isLoading}
  placeholder="Search {entities}..."
/>
```

## Conditional Fields

```tsx
const type = watch('type')

{type === 'advanced' && (
  <Controller
    name="advancedOption"
    control={control}
    render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor="advancedOption">Advanced Option</FieldLabel>
        <FieldContent>
          <Input id="advancedOption" {...field} />
          <FieldError errors={[fieldState.error]} />
        </FieldContent>
      </Field>
    )}
  />
)}
```

For isolated conditional rendering without re-rendering the whole form, use `useWatch` in a child component:

```tsx
function ConditionalSection({ control }: { control: Control<FormData> }) {
  const type = useWatch({ control, name: 'type' })
  if (type !== 'advanced') return null
  return <AdvancedOptions control={control} />
}
```

## Field Arrays

```tsx
import { Controller, useFieldArray } from 'react-hook-form'

const { fields, append, remove } = useFieldArray({
  control,
  name: 'items',
})

{fields.map((arrayField, index) => (
  <div key={arrayField.id} className="flex gap-2">
    <Controller
      name={`items.${index}.value`}
      control={control}
      render={({ field, fieldState }) => (
        <Field className="flex-1" data-invalid={fieldState.invalid}>
          <FieldContent>
            <Input {...field} />
            <FieldError errors={[fieldState.error]} />
          </FieldContent>
        </Field>
      )}
    />
    {fields.length > 1 && (
      <Button type="button" variant="outline" size="icon" onClick={() => remove(index)}>
        <Trash2 className="h-4 w-4" />
      </Button>
    )}
  </div>
))}

<Button type="button" variant="outline" size="sm" onClick={() => append({ value: '' })}>
  <Plus className="h-4 w-4 mr-2" /> Add Item
</Button>
```

## FieldSet Grouping

```tsx
import { FieldSet, FieldLegend, FieldGroup } from '@/components/ui/field'

<FieldSet>
  <FieldLegend>Personal Information</FieldLegend>
  <FieldGroup>
    <Controller name="name" control={control} render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor="name">Name</FieldLabel>
        <FieldContent>
          <Input id="name" {...field} />
          <FieldError errors={[fieldState.error]} />
        </FieldContent>
      </Field>
    )} />
    <Controller name="email" control={control} render={({ field, fieldState }) => (
      <Field data-invalid={fieldState.invalid}>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <FieldContent>
          <Input id="email" {...field} />
          <FieldError errors={[fieldState.error]} />
        </FieldContent>
      </Field>
    )} />
  </FieldGroup>
</FieldSet>
```

## Field Component API

| Component | Purpose |
|-----------|---------|
| `Field` | Container for a form field group. Accepts `data-invalid` for error styling |
| `FieldLabel` | Label with `htmlFor` attribute |
| `FieldContent` | Wrapper for input + description + error |
| `FieldDescription` | Help text below input |
| `FieldError` | Displays validation errors. Accepts `errors` array |
| `FieldSet` | Groups related fields semantically (`<fieldset>`) |
| `FieldLegend` | Title for a FieldSet (`<legend>`) |
| `FieldGroup` | Container for multiple fields (supports `@container` queries) |

## Form Props Pattern

Standard props that forms should accept:

```tsx
type BaseFormProps<T> = {
  id?: string                    // For external submit buttons (e.g., in DialogFooter)
  onSubmit: (data: T) => void    // Callback with validated data
  onCancel?: () => void          // Cancel action
  isSubmitting?: boolean         // Loading state from parent's mutation
  defaultValues?: Partial<T>    // Pre-fill values
}
```

Use `<fieldset disabled={isSubmitting}>` to disable all fields during submission instead of disabling each field individually.

## Common Violations

**1. Mutation Inside Form**
Forms receive `onSubmit` and `isSubmitting` from parent. Never import `useMutation` inside a form component.

**2. Using register() Instead of Controller**
ALL fields must use `Controller` to access `fieldState` for `data-invalid` styling and `FieldError` display.

**3. useEffect for Field Sync**
```tsx
// WRONG — syncing form state via useEffect
useEffect(() => { setValue('name', data.name) }, [data])
useEffect(() => { reset(data) }, [data, reset])

// CORRECT — remount the form via key when data changes
<MyForm key={entity.id} defaultValues={entity} onSubmit={handleSubmit} />
```

**4. Watching All Fields**
```tsx
// WRONG — re-renders on ANY change
const allData = watch()

// CORRECT — watch specific field
const type = watch('type')

// BETTER — useWatch for conditional UI in child components
const type = useWatch({ control, name: 'type' })
```

**5. Redefining Contract Validation**
Form schemas must derive from contracts via `.pick()`, `.omit()`, `.extend()`, or `.partial()`. Never duplicate validation rules inline. See `references/schema-derivation.md`.

## Success Criteria

- [ ] Schema derived from contracts using `.pick()`/`.omit()`/`.extend()`
- [ ] Form receives `onSubmit`, `onCancel`, `isSubmitting`, `defaultValues` as props
- [ ] Uses `zodResolver` with Zod schema (fallback to `standardSchemaResolver` if needed)
- [ ] ALL fields use `Controller` — never use `register()`
- [ ] `Field` has `data-invalid={fieldState.invalid}` for error styling
- [ ] Uses `fieldState.error` (not `errors.fieldName`) for error display
- [ ] All inputs have matching `id` and `htmlFor` attributes
- [ ] No mutations inside the form component
- [ ] Error messages display with `<FieldError errors={[fieldState.error]} />`
- [ ] Validation messages in project's language

## Resources

- `references/schema-derivation.md` — Contract-first schema derivation patterns (pick/omit/extend/partial)
- `/contracts` skill — Creating Zod schemas for API contracts
- `/orpc-query` skill — Mutation hooks and error handling in parent components
- `/clean-architecture` skill — How forms fit in the frontend layer
