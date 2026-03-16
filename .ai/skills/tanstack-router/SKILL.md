---
name: tanstack-router
description: >-
  TanStack Router file-based routing patterns: layout vs index routes, auth guard layouts,
  org-scoped routes, search params validation, route-level error/pending components, and
  the critical Outlet pitfall. Use when creating new routes, restructuring navigation,
  adding route guards, debugging routing issues, or when a page is blank / routes are not
  rendering. Also use when the user mentions file-based routing, route guards, beforeLoad,
  or Outlet-related problems.
scope: [tanstack-router]
---

# TanStack Router File-Based Routing

File-based routing conventions for TanStack Router. Covers route organization, layout patterns, auth guards, search params, and common pitfalls.

## Critical Rule

**If a directory `foo/` exists with child routes, a sibling `foo.tsx` becomes a LAYOUT route.**

Layout routes MUST render `<Outlet />` to display child routes. If they don't, child routes will never appear.

## Route File Patterns

### When to Use Each Pattern

| Pattern | Use When | Example |
|---------|----------|---------|
| `foo.tsx` alone | Simple page, no nested routes | `dashboard.tsx` |
| `foo/index.tsx` | Page at `/foo` with sibling routes in same directory | `items/index.tsx` + `items/$id.tsx` |
| `foo.tsx` + `foo/` | Layout wrapper for nested routes (shared UI) | `_authenticated.tsx` + `_authenticated/` |

### Pattern 1: Sibling Routes (No Shared Layout)

Multiple routes at the same level that don't share layout UI:

```
items/
  index.tsx           # Matches /items/
  $id.tsx             # Matches /items/$id
```

Both routes are siblings. Navigation between them works correctly.

### Pattern 2: Layout Route with Children

Child routes that share common UI (sidebar, tabs, navigation):

```
resources/
  $resourceId.tsx       # Layout with <Outlet /> (wraps children)
  $resourceId/
    overview.tsx        # Child route
    settings.tsx        # Child route
```

The `$resourceId.tsx` layout wraps all children and MUST contain `<Outlet />`.

### Pattern 3: Pathless Layout (Underscore Prefix)

Group routes under shared UI without adding a URL segment:

```
routes/
  _authenticated.tsx        # Layout — beforeLoad guards + <Outlet />
  _authenticated/
    $orgSlug.tsx            # Nested layout — org context + <Outlet />
    $orgSlug/
      dashboard.tsx         # Page component
      items/
        index.tsx           # List page
        $id.tsx             # Detail page
```

Underscore-prefixed routes (`_authenticated`, `_auth`) don't add to the URL path — they only provide layout and `beforeLoad` logic.

## Common Mistake: Missing Outlet

**WRONG:**
```
items/
  details.tsx              # This becomes a layout (no Outlet!)
  details/
    $id.tsx                # Never renders!
```

When `details/` directory exists, `details.tsx` is treated as a layout. Without `<Outlet />`, the child `$id.tsx` never renders.

**FIX:**
```
items/
  details/
    index.tsx              # Matches /details/
    $id.tsx                # Matches /details/$id (works!)
```

## Route Configuration Patterns

### Root Route

Use `createRootRouteWithContext` to inject app-wide context (e.g., query client):

```typescript
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  errorComponent: RootErrorComponent,
  notFoundComponent: NotFoundComponent,
})

function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  )
}
```

### Auth Guard Layout

Use `beforeLoad` on a pathless layout to protect all nested routes:

```typescript
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (!session.data) {
      throw redirect({ to: '/login' })
    }
    return { authData: session.data }
  },
  pendingComponent: AuthPending,
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { authData } = Route.useRouteContext()
  return (
    <AuthProvider value={authData}>
      <Outlet />
    </AuthProvider>
  )
}
```

### Org-Scoped Layout

Validate org membership and set org context for all child routes:

```typescript
export const Route = createFileRoute('/_authenticated/$orgSlug')({
  beforeLoad: async ({ params, context }) => {
    const org = context.organizations.find((o) => o.slug === params.orgSlug)
    if (!org) {
      throw redirect({ to: '/onboarding' })
    }
    return { org }
  },
  component: OrgLayout,
})

function OrgLayout() {
  const { org } = Route.useRouteContext()
  return (
    <OrganizationProvider value={org}>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </OrganizationProvider>
  )
}
```

### Guest-Only Layout (Reverse Guard)

Redirect already-authenticated users away from login/signup:

```typescript
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_auth')({
  beforeLoad: async () => {
    const session = await authClient.getSession()
    if (session.data) {
      throw redirect({ to: '/' })
    }
  },
  component: GuestLayout,
})

function GuestLayout() {
  return <Outlet />
}
```

### Search Params Validation

Use Zod schemas with `validateSearch` for type-safe search params:

```typescript
import { z } from 'zod'

const searchSchema = z.object({
  callbackURL: z.string().optional(),
})

export const Route = createFileRoute('/login')({
  validateSearch: searchSchema,
  component: LoginPage,
})

function LoginPage() {
  const { callbackURL } = Route.useSearch()
  // callbackURL is typed as string | undefined
}
```

### Route-Level Error and Pending Components

Define error/pending handling per route:

```typescript
import { createFileRoute, type ErrorComponentProps } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/$orgSlug/items/')({
  component: ListView,
  pendingComponent: () => <LoadingSpinner />,
  errorComponent: ListErrorComponent,
})

function ListErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <div>
      <p>{error instanceof Error ? error.message : 'An error occurred'}</p>
      <Button onClick={reset}>Retry</Button>
    </div>
  )
}
```

## Route File Convention: Keep Routes Thin

Route files should be thin — delegate to feature views:

```typescript
// CORRECT — thin route file
import { createFileRoute } from '@tanstack/react-router'
import { ItemsListView } from '@/features/items/views/items-list-view'

export const Route = createFileRoute('/_authenticated/$orgSlug/items/')({
  component: ItemsListView,
})
```

```typescript
// WRONG — business logic in route file
export const Route = createFileRoute('/_authenticated/$orgSlug/items/')({
  component: () => {
    const items = useQuery(/* ... */)
    // 100+ lines of UI logic here...
  },
})
```

Route files define routing configuration (guards, search params, error/pending components). UI and data fetching live in feature directories.

## Route Path Conventions

| File | Route Path in `createFileRoute` |
|------|-------------------------------|
| `foo.tsx` | `'/path/to/foo'` |
| `foo/index.tsx` | `'/path/to/foo/'` (trailing slash) |
| `foo/$param.tsx` | `'/path/to/foo/$param'` |
| `_layout.tsx` | `'/_layout'` (no URL segment) |

## Decision Checklist

Before creating a route, ask:

1. **Will there be child routes in a subdirectory?**
   - YES with shared UI → Create layout (must have `<Outlet />`)
   - YES without shared UI → Use `index.tsx` in the subdirectory
   - NO → Simple `foo.tsx` is fine

2. **Does a subdirectory with the same name already exist?**
   - YES → You MUST either:
     - Add `<Outlet />` to render children (layout pattern)
     - Move your file into the directory as `index.tsx` (sibling pattern)

3. **Does the route need auth/org protection?**
   - Place it under `_authenticated/` (or your project's guard layout)

4. **Does the route have search params?**
   - Define a Zod schema and use `validateSearch`

## Verification

After creating routes, regenerate the route tree and verify:

```bash
# Regenerate route tree (framework does this on dev server start)
vite build  # or start dev server

# Verify routes are valid
typecheck
```

Check the generated `routeTree.gen.ts` to verify routes are registered correctly.

## Common Violations

**1. Layout Without Outlet**

A file becomes a layout when a same-named directory exists. If you forget `<Outlet />`, all child routes silently disappear.

**2. Business Logic in Route Files**

Route files should only contain `createFileRoute()` config and thin wrapper components. Move all logic to feature views/components.

**3. Missing Auth Guard**

Protected routes must live under a guard layout (`_authenticated/`). Placing a route outside the guard layout makes it publicly accessible.

**4. Hardcoded Redirect Paths**

Use route references and params instead of string concatenation:

```typescript
// WRONG
throw redirect({ to: `/${params.orgSlug}/dashboard` })

// CORRECT
throw redirect({ to: '/$orgSlug/dashboard', params: { orgSlug: params.orgSlug } })
```

**5. Inline Error Components Without Reset**

Always accept and wire the `reset` callback from `ErrorComponentProps` — it lets users retry without a full page reload.

## Cross-References

| What | Skill |
|------|-------|
| Data fetching in route components | `/orpc-query` |
| Forms in route pages | `/form` |
| Data tables in list routes | `/data-table` |
| API contracts for search params | `/contracts` |
