---
name: authorization
description: >-
  Role-based access control (RBAC) with permission checks in use cases.
  Use this skill when adding authorization to use cases, defining new permissions,
  restricting actions by role, preventing role escalation, or reviewing code for
  missing permission checks. Also use when adding new resources that need RBAC.
  Do NOT load for authentication flows, login/logout, session management, or token handling.
scope: ["clean-architecture"]
---

# Authorization (RBAC)

Implements role-based access control using pure functions from the core services layer. Authorization is a **use case concern** — every use case that mutates data or accesses restricted resources MUST check permissions before any business logic.

> **Before implementing**: Read your project's authorization service at `{core}/services/authorization.ts` (or `{core}/domain/services/authorization.ts`) to discover the **actual roles**, **permissions**, and **function signatures**. The patterns below are generic — adapt role names and permissions to your project.

## Quick Start

1. Import `hasPermission` from the project's authorization service
2. Add `memberRoles: Role[]` to use case input type
3. Check permission **FIRST** in the use case (before any logic)
4. Add `FORBIDDEN` error to procedure and map it

```typescript
import { hasPermission, type Role } from '{core}/services/authorization'

if (!hasPermission(input.memberRoles, '{entities}:write')) {
  return errAsync({ type: 'forbidden', message: 'Insufficient permissions' })
}
```

## Authorization Service Structure

The authorization service is a **pure module** in the core layer — no dependency injection, no side effects. It exports types, constants, and pure functions.

### Role Hierarchy

Roles have numeric levels for comparison. Higher number = more privilege.

```typescript
// {core}/services/authorization.ts
export type Role = 'owner' | 'admin' | 'member'  // Read your project's actual roles

export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 100,
  admin: 80,
  member: 40,
}
```

> Projects define their own role names and levels. Common patterns: 3-tier (owner > admin > member), 4-tier (owner > admin > member > viewer). Some projects have domain-specific roles (e.g., accountant). Always read the project's service to discover the real roles.

### Permission Format

Permissions follow the `resource:action` convention:

```typescript
export type Permission =
  | 'organization:read' | 'organization:manage' | 'organization:delete'
  | 'members:read' | 'members:invite' | 'members:remove' | 'members:update_role'
  | '{entities}:read' | '{entities}:write' | '{entities}:delete'
  | 'billing:read' | 'billing:manage'
```

### Role-Permission Mapping

Each role maps to an explicit list of permissions — no inheritance, no wildcards. This makes the matrix auditable.

```typescript
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    'organization:read', 'organization:manage', 'organization:delete',
    'members:read', 'members:invite', 'members:remove', 'members:update_role',
    '{entities}:read', '{entities}:write', '{entities}:delete',
    'billing:read', 'billing:manage',
  ],
  admin: [
    'organization:read', 'organization:manage',
    'members:read', 'members:invite', 'members:remove',
    '{entities}:read', '{entities}:write', '{entities}:delete',
  ],
  member: [
    'organization:read',
    'members:read',
    '{entities}:read', '{entities}:write',
  ],
}
```

### Core Functions

```typescript
// Multi-role: user can hold multiple roles (e.g., via Better Auth organization plugin).
// hasPermission checks if ANY of the user's roles grants the permission.
export const hasPermission = (roles: Role[], permission: Permission): boolean => {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission) ?? false)
}

// Union of all permissions across the user's roles
export const getPermissions = (roles: Role[]): readonly Permission[] => {
  const permissionSet = new Set(roles.flatMap((role) => ROLE_PERMISSIONS[role] ?? []))
  return [...permissionSet]
}

// Compare hierarchy levels (uses highest role in array)
export const hasHigherOrEqualRole = (role: Role, targetRole: Role): boolean => {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[targetRole]
}

// Get the highest-privilege role from a roles array
export const getHighestRole = (roles: Role[]): Role => {
  return roles.reduce((highest, role) =>
    ROLE_HIERARCHY[role] > ROLE_HIERARCHY[highest] ? role : highest
  )
}

// Parse roles from Better Auth format (comma-separated string)
export const parseRoles = (roleString: string): Role[] => {
  return roleString.split(',').filter((r): r is Role => r in ROLE_HIERARCHY)
}
```

## Use Case Pattern

Authorization is checked via direct import — `hasPermission` is a pure function, not an injected dependency.

```typescript
import { hasPermission, type Role } from '{core}/services/authorization'
import { errAsync, type ResultAsync } from 'neverthrow'

type Update{Entity}Input = {
  organizationId: string
  memberId: string
  memberRoles: Role[]
  {entity}Id: string
  data: { name?: string }
}

type Update{Entity}Error =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; message: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; cause: unknown }

export const makeUpdate{Entity} =
  (deps: Dependencies) =>
  (input: Update{Entity}Input): ResultAsync<{Entity}, Update{Entity}Error> => {
    // 1. Authorization check FIRST — before any business logic or DB calls
    if (!hasPermission(input.memberRoles, '{entities}:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'Insufficient permissions',
      })
    }

    // 2. Business logic after authorization passes
    const ctx = { organizationId: input.organizationId }

    return deps.{entity}Repository
      .findById(ctx, input.{entity}Id)
      .andThen(({entity}) => {
        const result = create{Entity}({ ...{entity}, ...input.data })
        if (result.isErr()) {
          return errAsync({ type: 'validation_error', message: result.error.message })
        }
        return deps.{entity}Repository.update(ctx, input.{entity}Id, result.value)
      })
  }
```

## Procedure Pattern

The procedure passes member info from the authenticated context. The `role` field from Better Auth's organization plugin contains the comma-separated roles string — parse it before passing to the use case.

```typescript
export const update{Entity} = authProcedure
  .errors({
    FORBIDDEN: { message: 'Insufficient permissions' },
    NOT_FOUND: { message: '{Entity} not found' },
    VALIDATION_ERROR: { message: 'Validation failed' },
  })
  .input(update{Entity}InputSchema)
  .output({entity}Schema)
  .handler(async ({ input, context, errors }) => {
    const result = await makeUpdate{Entity}({
      {entity}Repository: create{Entity}Repository(context.db),
    })({
      organizationId: context.organization.id,
      memberId: context.organization.memberId,
      memberRoles: parseRoles(context.organization.role),
      {entity}Id: input.id,
      data: input,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'not_found':
          throw errors.NOT_FOUND()
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: result.error.message })
        case 'repository_error':
          console.error('Repository error:', result.error.cause)
          throw new Error('Internal error')
      }
    }

    return result.value
  })
```

## Role Hierarchy Checks

Beyond permission checks, some operations require comparing role levels directly.

### Preventing Role Escalation

Users can only assign roles **lower** than their own highest role:

```typescript
import { getHighestRole, hasHigherOrEqualRole } from '{core}/services/authorization'

// In a use case that updates member roles
const actorHighest = getHighestRole(input.memberRoles)

if (!hasHigherOrEqualRole(actorHighest, input.targetRole)) {
  return errAsync({
    type: 'forbidden',
    message: 'Cannot assign a role equal to or higher than your own',
  })
}
```

> Use **strict greater-than** (`>` not `>=`) when checking role assignment to prevent same-level assignment. Use `hasHigherOrEqualRole` for "can this user manage this other user" checks.

### Owner-Only Actions

For actions restricted to the organization owner (e.g., delete org, manage billing):

```typescript
import { getHighestRole } from '{core}/services/authorization'

if (getHighestRole(input.memberRoles) !== 'owner') {
  return errAsync({
    type: 'forbidden',
    message: 'Only the organization owner can perform this action',
  })
}
```

## Adding New Permissions

When adding a new resource to the system:

### 1. Add to Permission Type

```typescript
// {core}/services/authorization.ts
export type Permission =
  | /* ... existing ... */
  | '{newresource}:read'
  | '{newresource}:write'
  | '{newresource}:delete'
```

### 2. Assign to Roles

Decide which roles get which permissions. Follow **principle of least privilege** — start restrictive, widen later.

```typescript
export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    // ... existing
    '{newresource}:read', '{newresource}:write', '{newresource}:delete',
  ],
  admin: [
    // ... existing
    '{newresource}:read', '{newresource}:write', '{newresource}:delete',
  ],
  member: [
    // ... existing
    '{newresource}:read', '{newresource}:write',
  ],
}
```

### 3. Use in Use Case

```typescript
if (!hasPermission(input.memberRoles, '{newresource}:write')) {
  return errAsync({ type: 'forbidden', message: 'Insufficient permissions' })
}
```

## Common Violations

**1. Missing authorization check**

```typescript
// WRONG — No permission check
export const makeCreate{Entity} = (deps) => (input) => {
  return deps.repository.create(ctx, input)
}

// CORRECT — Authorization FIRST
export const makeCreate{Entity} = (deps) => (input) => {
  if (!hasPermission(input.memberRoles, '{entities}:write')) {
    return errAsync({ type: 'forbidden', message: 'Insufficient permissions' })
  }
  return deps.repository.create(ctx, input)
}
```

**2. Authorization after business logic**

```typescript
// WRONG — Authorization happens after DB call
return deps.repository.findById(ctx, id)
  .andThen((entity) => {
    if (!hasPermission(input.memberRoles, '{entities}:write')) {  // Too late!
      return errAsync({ type: 'forbidden', message: '...' })
    }
    return deps.repository.update(ctx, id, entity)
  })

// CORRECT — Check before any work
if (!hasPermission(input.memberRoles, '{entities}:write')) {
  return errAsync({ type: 'forbidden', message: 'Insufficient permissions' })
}
return deps.repository.findById(ctx, id)
  .andThen((entity) => deps.repository.update(ctx, id, entity))
```

**3. Passing raw role string instead of parsed roles**

```typescript
// WRONG — Passing unparsed string from context
memberRole: context.organization.role,  // "admin,member" string

// CORRECT — Parse roles before passing to use case
memberRoles: parseRoles(context.organization.role),  // ['admin', 'member']
```

**4. Missing FORBIDDEN error in procedure**

```typescript
// WRONG — No FORBIDDEN in error definitions
.errors({
  NOT_FOUND: { message: 'Not found' },
})

// CORRECT — Include FORBIDDEN for any authorized procedure
.errors({
  FORBIDDEN: { message: 'Insufficient permissions' },
  NOT_FOUND: { message: 'Not found' },
})
```

## Best Practices

1. **Authorization first** — Check permissions before any business logic or database calls
2. **Pure functions** — Authorization service has no side effects, no DI needed
3. **Principle of least privilege** — Default unknown roles to zero permissions
4. **Explicit deny** — If a permission isn't in the role's list, it's denied
5. **Typed roles** — Never use raw strings for roles; use the `Role` type
6. **Multi-role union** — When a user has multiple roles, permissions are the union of all roles
7. **Read the project** — Always read the project's actual authorization service before implementing; don't assume role names or permissions

## Success Criteria

When adding authorization to a use case:

- [ ] Read project's authorization service to discover real roles and permissions
- [ ] Import `hasPermission` (and `parseRoles` if needed) from authorization service
- [ ] Add `memberRoles: Role[]` to input type
- [ ] Add `{ type: 'forbidden'; message: string }` to error union
- [ ] Check permission **FIRST** in the use case — before any business logic
- [ ] Add `FORBIDDEN` error to procedure's `.errors()` definition
- [ ] Map `forbidden` error to `errors.FORBIDDEN()` in procedure's exhaustive switch
- [ ] If adding a new resource: add permissions to `Permission` type and assign to roles

## Cross-References

| Skill | Relationship |
|-------|-------------|
| `/clean-architecture` | Authorization is step 4 in the inside-out pipeline |
| `/use-case` | Authorization checks live inside use cases |
| `/procedure` | Procedures pass `memberRoles` from context and map `FORBIDDEN` errors |
| `/domain` | Domain entities define what needs protecting; authorization decides who can act |
| `/port` | Ports don't know about authorization — that's a use case concern |
