---
name: orpc-query
description: >-
  Type-safe API hooks using oRPC + TanStack Query for queries, mutations, infinite queries,
  cache invalidation, and mutation error handling. Use this skill when creating query or mutation
  hooks, setting up the oRPC client, configuring cache invalidation, handling mutation errors
  with toasts, or building any frontend data-fetching layer that calls oRPC procedures.
  Triggers on: useQuery, useMutation, queryOptions, mutationOptions, orpc, cache invalidation,
  query key, infinite query, handleMutationError, api-client, onError mutation, toast error.
  Do NOT load for backend procedure definitions (use /procedure), Zod contracts (use /contracts),
  or non-oRPC API calls.
scope: ["clean-architecture"]
---

# oRPC Query

Type-safe API hooks using oRPC with TanStack Query. Covers client configuration, query hooks, mutations with cache invalidation, infinite queries, query key management, and centralized mutation error handling with sonner toasts.

> **Stack:** oRPC client + TanStack Query (React Query) + sonner for toasts. Projects map path placeholders (`{web}`, `{api}`, etc.) to their directory structure in CLAUDE.md. `{web}` is the frontend app root (e.g., `apps/web/src/`), distinct from `{app}` used by backend skills for the use-case layer.

## Location

```
{web}/
├── lib/
│   ├── api-client.ts              # oRPC client + React Query utils
│   └── api-errors.ts              # handleMutationError utility
└── features/{domain}/
    ├── hooks/
    │   ├── queries/
    │   │   ├── use-{entities}.ts   # List query hook
    │   │   └── use-{entity}.ts    # Detail query hook
    │   └── mutations/
    │       ├── use-create-{entity}.ts
    │       └── use-update-{entity}.ts
    └── components/
        ├── {entities}-list.tsx
        └── {entity}-form.tsx
```

No separate `*-keys.ts` files needed — oRPC provides `.key()` methods directly.

## Quick Start

1. Configure the oRPC client at `{web}/lib/api-client.ts` (see **Client Configuration** below)
2. Create the error handling utility at `{web}/lib/api-errors.ts` (see **Mutation Error Handling** below)
3. Write hooks using `queryOptions()` and `mutationOptions()`:

```typescript
// Query hook
export function use{Entity}({entity}Id: string) {
  return useQuery(orpc.{entities}.get.queryOptions({ input: { {entity}Id } }))
}

// Mutation hook
export function useCreate{Entity}() {
  const queryClient = useQueryClient()

  return useMutation({
    ...orpc.{entities}.create.mutationOptions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: orpc.{entities}.key() }),
    onError: (error) => handleMutationError(error, { fallbackMessage: 'Error creating {entity}' }),
  })
}
```

## Client Configuration

### Standard setup

```typescript
// {web}/lib/api-client.ts
import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { createORPCReactQueryUtils } from '@orpc/react-query'
import type { Router, RouterClient } from '{api}/procedures/router'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8787'

const link = new RPCLink({
  url: `${API_URL}/rpc`,
  fetch: (input, init) => {
    return fetch(input, { ...init, credentials: 'include' })
  },
})

export const client: RouterClient<Router> = createORPCClient(link)
export const orpc = createORPCReactQueryUtils(client)
```

The `RouterClient<Router>` type ensures the client is type-safe against the backend router. The `Router` type is exported from the backend's `router.ts` (see `/procedure`).

### Multi-tenancy (organization slug header)

For multi-tenant apps, inject the current organization slug into every request via a module-level variable:

```typescript
let currentOrgSlug: string | null = null

export function setCurrentOrgSlug(slug: string | null): void {
  currentOrgSlug = slug
}

export function getCurrentOrgSlug(): string | null {
  return currentOrgSlug
}

const link = new RPCLink({
  url: `${API_URL}/rpc`,
  fetch: (input, init) => {
    const headers = new Headers(init?.headers)

    if (currentOrgSlug) {
      headers.set('X-Organization-Slug', currentOrgSlug)
    }

    return fetch(input, { ...init, headers, credentials: 'include' })
  },
})
```

Call `setCurrentOrgSlug()` when the user navigates to an organization context (e.g., in a route loader or layout component).

## Query Patterns

### queryOptions (preferred)

The simplest and most common pattern. oRPC manages query keys automatically:

```typescript
import { useQuery } from '@tanstack/react-query'
import { orpc } from '{web}/lib/api-client'

export function use{Entities}(input?: List{Entities}Query) {
  return useQuery(orpc.{entities}.list.queryOptions({ input: input ?? {} }))
}

export function use{Entity}({entity}Id: string) {
  return useQuery(orpc.{entities}.get.queryOptions({ input: { {entity}Id } }))
}
```

### Manual query with custom configuration

When you need custom `staleTime`, `gcTime`, or other TanStack Query options:

```typescript
export function use{Entity}Summary({entity}Id: string) {
  return useQuery({
    ...orpc.{entities}.getSummary.queryOptions({ input: { {entity}Id } }),
    staleTime: 1000 * 60 * 5,     // 5 minutes
    gcTime: 1000 * 60 * 30,       // 30 minutes cache
  })
}
```

### Conditional queries

Use `enabled` to defer a query until a dependency is available:

```typescript
export function use{Entity}Details({entity}Id: string | undefined) {
  return useQuery({
    ...orpc.{entities}.get.queryOptions({ input: { {entity}Id: {entity}Id ?? '' } }),
    enabled: !!{entity}Id,
  })
}
```

## Query Key Management

oRPC provides built-in methods for query key management. **Do NOT create custom query key factories** — oRPC keys are type-safe, automatic, and refactor-friendly.

| Method | Purpose | Use Case |
|--------|---------|----------|
| `.key()` | Partial matching | Invalidate all queries for a domain |
| `.key({ input })` | Exact matching | Invalidate specific query |
| `.queryKey({ input })` | Full query key | `setQueryData`, `getQueryData` |
| `.mutationKey()` | Mutation key | Track mutation state |
| `.infiniteKey()` | Infinite query key | Invalidate infinite queries |

**Invalidation patterns:**

```typescript
import { useQueryClient } from '@tanstack/react-query'
import { orpc } from '{web}/lib/api-client'

// Invalidate ALL {entity} queries (list, get, etc.)
queryClient.invalidateQueries({ queryKey: orpc.{entities}.key() })

// Invalidate specific list query
queryClient.invalidateQueries({ queryKey: orpc.{entities}.list.key() })

// Invalidate specific detail query with input
queryClient.invalidateQueries({
  queryKey: orpc.{entities}.get.key({ input: { {entity}Id } })
})

// Get/set specific query data
const {entity} = queryClient.getQueryData(
  orpc.{entities}.get.queryKey({ input: { {entity}Id } })
)

queryClient.setQueryData(
  orpc.{entities}.get.queryKey({ input: { {entity}Id } }),
  updated{Entity}
)
```

## Mutations

### Standard mutation with cache invalidation

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { orpc } from '{web}/lib/api-client'
import { handleMutationError } from '{web}/lib/api-errors'

export function useCreate{Entity}() {
  const queryClient = useQueryClient()

  return useMutation({
    ...orpc.{entities}.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.{entities}.key() })
    },
    onError: (error) => {
      handleMutationError(error, { fallbackMessage: 'Error creating {entity}' })
    },
  })
}
```

### Update mutation with targeted invalidation

Use the `variables` parameter in `onSuccess` to invalidate the specific detail query:

```typescript
export function useUpdate{Entity}() {
  const queryClient = useQueryClient()

  return useMutation({
    ...orpc.{entities}.update.mutationOptions(),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: orpc.{entities}.key() })
      queryClient.invalidateQueries({
        queryKey: orpc.{entities}.get.key({ input: { {entity}Id: variables.{entity}Id } })
      })
    },
    onError: (error) => {
      handleMutationError(error, { fallbackMessage: 'Error updating {entity}' })
    },
  })
}
```

### Cross-domain cache invalidation

When a mutation affects related entities, invalidate their caches too:

```typescript
export function useCreate{Entity}() {
  const queryClient = useQueryClient()

  return useMutation({
    ...orpc.{entities}.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.{entities}.key() })
      // Also invalidate related domain that may show updated counts or state
      queryClient.invalidateQueries({ queryKey: orpc.relatedDomain.key() })
    },
    onError: (error) => {
      handleMutationError(error, { fallbackMessage: 'Error creating {entity}' })
    },
  })
}
```

### Mutation with callback options

When components need to react to mutation success (close dialogs, navigate, show toasts), expose callback options:

```typescript
interface UseCreate{Entity}Options {
  onSuccess?: () => void
}

export function useCreate{Entity}(options: UseCreate{Entity}Options = {}) {
  const queryClient = useQueryClient()

  return useMutation({
    ...orpc.{entities}.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.{entities}.key() })
      options.onSuccess?.()
    },
    onError: (error) => {
      handleMutationError(error, { fallbackMessage: 'Error creating {entity}' })
    },
  })
}
```

### Mutation with optimistic updates

For instant UI feedback before the server responds:

```typescript
export function useUpdate{Entity}() {
  const queryClient = useQueryClient()

  return useMutation({
    ...orpc.{entities}.update.mutationOptions(),
    onMutate: async (newData) => {
      await queryClient.cancelQueries({
        queryKey: orpc.{entities}.get.key({ input: { {entity}Id: newData.{entity}Id } })
      })

      const previous = queryClient.getQueryData(
        orpc.{entities}.get.queryKey({ input: { {entity}Id: newData.{entity}Id } })
      )

      queryClient.setQueryData(
        orpc.{entities}.get.queryKey({ input: { {entity}Id: newData.{entity}Id } }),
        (old: {Entity} | undefined) => old ? { ...old, ...newData } : old
      )

      return { previous }
    },
    onError: (_err, newData, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          orpc.{entities}.get.queryKey({ input: { {entity}Id: newData.{entity}Id } }),
          context.previous
        )
      }
      handleMutationError(_err, { fallbackMessage: 'Error updating {entity}' })
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: orpc.{entities}.get.key({ input: { {entity}Id: variables.{entity}Id } })
      })
    },
  })
}
```

## Infinite Queries

For paginated lists with "load more" functionality:

```typescript
import { useInfiniteQuery } from '@tanstack/react-query'
import { orpc } from '{web}/lib/api-client'

const PAGE_SIZE = 20

export function use{Entity}History(filters?: { status?: string }) {
  return useInfiniteQuery({
    ...orpc.{entities}.listHistory.infiniteOptions({
      input: { limit: PAGE_SIZE, status: filters?.status },
    }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      if (!lastPage.hasMore) return undefined
      return lastPageParam + PAGE_SIZE
    },
  })
}

// Invalidate with infiniteKey()
queryClient.invalidateQueries({
  queryKey: orpc.{entities}.listHistory.infiniteKey()
})
```

Usage in components:

```typescript
function {Entity}HistoryList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = use{Entity}History()
  const allItems = data?.pages.flatMap(page => page.items) ?? []

  return (
    <div>
      {allItems.map(item => <{Entity}Item key={item.id} item={item} />)}
      {hasNextPage && (
        <Button onClick={() => fetchNextPage()} disabled={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
```

## Mutation Error Handling

Centralized error handling ensures consistent UX across all mutations: UNAUTHORIZED redirects to login, known errors show their message as a toast, unknown errors show a fallback.

### The `handleMutationError` utility

Create once at `{web}/lib/api-errors.ts`. Uses `ORPCError` instanceof check (not `isDefinedError`) because it needs to work generically across all procedures:

```typescript
// {web}/lib/api-errors.ts
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

    // Show the error message from the procedure definition
    toast.error(error.message)
    return
  }

  // Unknown error — show fallback
  toast.error(fallbackMessage)
}
```

> **Note:** Toast messages and the fallback should use your project's language. The examples above use English — adapt to match your project.

**Behavior:**
- `UNAUTHORIZED` — toast + redirect to login (or custom `onUnauthorized` handler)
- Other oRPC errors — show `error.message` as toast (the message from the backend procedure)
- Unknown errors — show fallback message

### How error messages flow

Backend procedures forward the use case's descriptive message via `throw errors.BAD_REQUEST({ message: result.error.message })` (see `/procedure`). `handleMutationError` reads `error.message` and shows it as a toast automatically. This means the actual reason (e.g., "Email already exists") is displayed without any frontend mapping.

### When to use `isDefinedError`

`isDefinedError` is a type guard scoped to the procedure's error types. It **cannot** be used in a generic utility — it must be used locally in each hook's `onError` where TypeScript can infer the procedure's error types.

Use `isDefinedError` **only** when you need a different UX action beyond showing a toast:
- Redirecting to a different page (e.g., upgrade page on `PAYMENT_REQUIRED`)
- Opening a specific dialog or modal
- Performing cleanup actions specific to an error type
- Accessing typed `data` fields from the error

```typescript
import { isDefinedError } from '@orpc/client'

export function useCreate{Entity}() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  return useMutation({
    ...orpc.{entities}.create.mutationOptions(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: orpc.{entities}.key() })
    },
    onError: (error) => {
      // UX-specific behavior: redirect to billing on plan limit
      if (isDefinedError(error) && error.code === 'PAYMENT_REQUIRED') {
        toast.error(error.message)
        navigate({ to: '/settings/billing' })
        return
      }

      // Default: handles UNAUTHORIZED, shows error.message, etc.
      handleMutationError(error, { fallbackMessage: 'Error creating {entity}' })
    },
  })
}
```

### Component usage

Components only need `onSuccess` for component-specific behavior. Errors are handled by the hook:

```typescript
// In component — no onError needed
create{Entity}(data, {
  onSuccess: () => {
    toast.success('{Entity} created')
    onClose()
  },
})
```

## Common Violations

**1. Custom query key factories instead of oRPC's `.key()`**

```typescript
// WRONG — oRPC has built-in key management
export const {entity}Keys = {
  all: ['{entities}'] as const,
  detail: (id: string) => [...{entity}Keys.all, id] as const,
}
queryClient.invalidateQueries({ queryKey: {entity}Keys.all })

// CORRECT — use oRPC's built-in key methods
queryClient.invalidateQueries({ queryKey: orpc.{entities}.key() })
```

**2. Missing `handleMutationError` in `onError`**

```typescript
// WRONG — generic error handling, no UNAUTHORIZED redirect
onError: (error) => {
  toast.error(error.message ?? 'Something went wrong')
}

// CORRECT — centralized handling with UNAUTHORIZED support
onError: (error) => {
  handleMutationError(error, { fallbackMessage: 'Error creating {entity}' })
}
```

**3. Using `isDefinedError` just to extract error messages**

```typescript
// WRONG — handleMutationError already shows error.message
onError: (error) => {
  if (isDefinedError(error) && error.code === 'BAD_REQUEST') {
    toast.error(error.message)  // This is what handleMutationError does!
    return
  }
  handleMutationError(error, { fallbackMessage: '...' })
}

// CORRECT — just use handleMutationError
onError: (error) => {
  handleMutationError(error, { fallbackMessage: '...' })
}
```

**4. Error handling at the component call-site instead of the hook**

```typescript
// WRONG — every component duplicates error handling
create{Entity}(data, {
  onError: (error) => toast.error(error.message),
})

// CORRECT — hook handles errors, component only handles success
create{Entity}(data, {
  onSuccess: () => { toast.success('Created'); onClose() },
})
```

**5. Direct `orpc.*.call()` outside React Query**

```typescript
// WRONG — bypasses React Query cache and devtools
async function loadData() {
  const items = await orpc.{entities}.list.call({})
  setItems(items)
}

// CORRECT — always use hooks
function {Entity}List() {
  const { data } = use{Entities}()
  return <List items={data?.items} />
}
```

## Success Criteria

When creating frontend data-fetching hooks:

- [ ] Client configured at `{web}/lib/api-client.ts` with `createORPCReactQueryUtils` and `RouterClient<Router>` typing
- [ ] Queries use `queryOptions()` pattern (spread into `useQuery`)
- [ ] Mutations use `mutationOptions()` pattern (spread into `useMutation`)
- [ ] Cache invalidation uses oRPC's `.key()` methods — no custom key factories
- [ ] `handleMutationError` utility created at `{web}/lib/api-errors.ts`
- [ ] All mutation hooks have `onError` with `handleMutationError` and a context-specific `fallbackMessage`
- [ ] `isDefinedError` only used for UX-specific behavior (redirects, modals), never just for messages
- [ ] Components don't handle errors — hooks do. Components only use `onSuccess` for UI actions
- [ ] No direct `orpc.*.call()` outside React Query hooks
- [ ] Infinite queries use `infiniteOptions()` with `infiniteKey()` for invalidation

## Cross-References

| When | Skill |
|------|-------|
| Defining the procedures these hooks call | `/procedure` |
| Defining input/output Zod schemas | `/contracts` |
| Understanding the full backend flow | `/clean-architecture` |
| Building forms that use these mutations | `/form` |
| Building data tables that use these queries | `/data-table` |
| Routing that triggers these queries | `/tanstack-router` |
