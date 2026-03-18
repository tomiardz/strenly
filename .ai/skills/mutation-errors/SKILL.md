---
name: mutation-errors
description: |
  Guidelines for handling errors in mutation hooks with oRPC/tRPC and TanStack Query.
  Provides consistent error handling: UNAUTHORIZED redirects, typed error messages, and fallbacks.
  Use this skill when creating new mutation hooks or handling errors in components.
  Do NOT load for query error handling, form validation errors, or backend error definitions.
---

<objective>
Defines the error handling pattern for mutations using oRPC/tRPC + TanStack Query. Provides consistent handling for UNAUTHORIZED redirects, typed error messages, and fallbacks.
</objective>

<quick_start>
1. Create utility at `src/lib/api-errors.ts`
2. Import `handleMutationError` in mutation hooks
3. Add `onError` handler with `handleMutationError`
4. For UX-specific behavior (redirects, special flows), check `isDefinedError` BEFORE `handleMutationError`
5. Remove `onError` from component call-sites (hook handles errors)
</quick_start>

<how_error_messages_work>
Backend procedures pass the use case's descriptive message via `{ message: result.error.message }`:

```typescript
// In route handler
throw errors.BAD_REQUEST({ message: result.error.message });
throw errors.NOT_FOUND({ message: result.error.message });
throw errors.PAYMENT_REQUIRED({ message: result.error.message });
throw errors.FORBIDDEN({ message: result.error.message });
```

`handleMutationError` reads `error.message` and shows it as a toast. This means the actual
use case reason (e.g., "Ya existe un instrumento con ese codigo CV") is displayed automatically.

**DO NOT** use `isDefinedError` just to extract error messages. That is what `handleMutationError`
already does. Only use `isDefinedError` when you need to perform a **UX action** based on the
error code (see below).
</how_error_messages_work>

<core_utility>
Create a utility at `src/lib/api-errors.ts`:

**IMPORTANT:** `handleMutationError` uses `ORPCError` (instanceof check), NOT `isDefinedError`.
`isDefinedError` is a type guard that needs procedure type context to work - it cannot be used
in a generic utility function. Use `isDefinedError` only in individual hook `onError` handlers
for procedure-specific UX behavior (see mutation_hook_pattern below).

```typescript
import { ORPCError } from '@orpc/client'
import { toast } from 'sonner'

interface HandleMutationErrorOptions {
  fallbackMessage?: string
  onUnauthorized?: () => void
}

export function handleMutationError(
  error: unknown,
  options: HandleMutationErrorOptions = {}
) {
  const { fallbackMessage = 'An error occurred', onUnauthorized } = options

  if (error instanceof ORPCError) {
    if (error.code === 'UNAUTHORIZED') {
      toast.error('Session expired')
      if (onUnauthorized) {
        onUnauthorized()
      } else {
        window.location.href = '/auth/login'
      }
      return
    }

    // Show the error message from procedure definition
    toast.error(error.message)
    return
  }

  // Unknown error - show fallback
  toast.error(fallbackMessage)
}
```

**Behavior:**
- `UNAUTHORIZED` → Shows "Session expired" toast and redirects to login
- Other oRPC errors → Shows the error message from the procedure definition
- Unknown errors → Shows the fallback message
</core_utility>

<mutation_hook_pattern>
**Simple Case (most hooks):**

Most hooks only need `handleMutationError`. The backend already passes descriptive messages,
so there is no need to extract them manually.

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc'
import { handleMutationError } from '@/lib/api-errors'

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    ...orpc.users.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.users.key() })
    },
    onError: (error) => {
      handleMutationError(error, { fallbackMessage: 'Error creating user' })
    },
  })
}
```

**With UX-Specific Behavior (rare):**

Use `isDefinedError` ONLY when you need to perform a **different UX action** based on the error code,
NOT to extract error messages. Examples of valid use cases:
- Redirecting the user to a different page (e.g., upgrade plan page on `PAYMENT_REQUIRED`)
- Opening a specific dialog or modal
- Triggering a different navigation flow
- Performing cleanup actions specific to an error type

```typescript
import { isDefinedError } from '@orpc/client'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { orpc } from '@/lib/orpc'
import { handleMutationError } from '@/lib/api-errors'

export function useCreateAccount() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    ...orpc.accounts.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.accounts.key() })
    },
    onError: (error) => {
      // Only use isDefinedError when you need a DIFFERENT UX BEHAVIOR, not just a different message
      if (isDefinedError(error) && error.code === 'PAYMENT_REQUIRED') {
        // Example: redirect to upgrade page instead of just showing a toast
        toast.error(error.message)
        navigate({ to: '/settings/billing' })
        return
      }

      // Fallback: handles UNAUTHORIZED redirect, shows error.message, etc.
      handleMutationError(error, { fallbackMessage: 'Error al crear la cuenta' })
    },
  })
}
```

**WRONG - Do NOT use `isDefinedError` just for messages:**

```typescript
// BAD - handleMutationError already shows error.message
onError: (error) => {
  if (isDefinedError(error) && error.code === 'PAYMENT_REQUIRED') {
    toast.error(error.message) // This is what handleMutationError does!
    return
  }
  handleMutationError(error, { fallbackMessage: '...' })
}

// GOOD - just use handleMutationError
onError: (error) => {
  handleMutationError(error, { fallbackMessage: '...' })
}
```
</mutation_hook_pattern>

<function_comparison>
| Function | Where to use | Purpose | Type Safety |
|----------|-------------|---------|-------------|
| `isDefinedError(error)` | In each hook's `onError` | UX behavior based on error code (redirects, modals, etc.) | Yes - needs procedure type context |
| `handleMutationError(error)` | In each hook's `onError` (as default) | Shows error message as toast, handles UNAUTHORIZED redirect | No - handles any error |
| `ORPCError` (instanceof) | Only inside `handleMutationError` utility | Generic oRPC error detection | No - no procedure type context |

**Key insight:** `isDefinedError` is a type guard scoped to the procedure's error types. It CANNOT be used in a generic utility function because it needs the procedure's type context to resolve error codes and `data` shapes. It MUST be used locally in each hook's `onError` handler where TypeScript can infer the procedure's error types.

**When to use `isDefinedError`:**
- You need to **do something different** besides showing a toast (redirect, open modal, cleanup, etc.)
- You need to access typed `data` fields from the error (e.g., `error.data.current`, `error.data.limit`)

**When NOT to use `isDefinedError`:**
- You just want to show the error message — `handleMutationError` already does this
- You want to show a different toast message — change the backend `message` instead
</function_comparison>

<component_usage>
Components only need `onSuccess` for component-specific behavior. Errors are handled by the hook:

```typescript
// In component
createUser(data, {
  onSuccess: () => {
    toast.success('User created successfully')
    onClose()
  },
  // No onError needed - hook handles it
})
```
</component_usage>

<options_reference>
```typescript
interface HandleMutationErrorOptions {
  /** Fallback message when error is not a defined oRPC error */
  fallbackMessage?: string
  /** Custom handler for UNAUTHORIZED errors (overrides default redirect) */
  onUnauthorized?: () => void
}
```

**Example with custom UNAUTHORIZED handling:**

```typescript
handleMutationError(error, {
  fallbackMessage: 'Error processing request',
  onUnauthorized: () => {
    // Custom logic instead of redirect
    clearLocalStorage()
    showLoginModal()
  },
})
```
</options_reference>

<backend_error_messages>
Backend route handlers pass the use case's descriptive message directly via `message`:

```typescript
// In route handler — message overrides the generic schema default
throw errors.BAD_REQUEST({ message: result.error.message })
throw errors.NOT_FOUND({ message: result.error.message })
throw errors.PAYMENT_REQUIRED({ message: result.error.message })
throw errors.FORBIDDEN({ message: result.error.message })
```

These messages are automatically shown by `handleMutationError` via `error.message`.
No need for `data.details` — the message field is the carrier.
</backend_error_messages>

<success_criteria>
When creating a new mutation hook:

- [ ] Import `handleMutationError` from `@/lib/api-errors`
- [ ] Add `onError` handler with `handleMutationError`
- [ ] Provide user-friendly `fallbackMessage` for unknown errors
- [ ] Only use `isDefinedError` if you need UX behavior beyond showing a toast (redirects, modals, etc.)
- [ ] Remove any `onError` handlers from component call-sites (hook handles errors)
- [ ] Keep `onSuccess` at call-site for component-specific behavior (toasts, close dialogs, etc.)
</success_criteria>
