---
name: authorization
description: >-
  Role-based access control (RBAC) with permission checks in use cases.
  Use this skill when adding, modifying, or migrating authorization in use cases,
  changing the role model or permission matrix, refactoring role types or names,
  updating hasPermission signatures, defining new permissions, restricting actions
  by role, preventing role escalation, migrating test context factories for roles,
  or reviewing code for missing permission checks. Also use when adding new
  resources that need RBAC. Triggers on: roles, permissions, hasPermission,
  ROLE_PERMISSIONS, OrganizationRole, memberRole, parseRoles, RBAC, authorization
  refactor.
  Do NOT load for authentication flows, login/logout, session management, or
  token handling.
scope: ["clean-architecture"]
---

# Authorization (RBAC)

Implements role-based access control using pure functions from the core services layer. Authorization is a **use case concern** — every use case that mutates data or accesses restricted resources checks permissions before any business logic.

## Critical: Read the Project First

Before implementing or modifying anything authorization-related, **always** read these files to discover the actual roles, permissions, and function signatures:

1. `{core}/services/authorization.ts` — the role type, permission type, `ROLE_PERMISSIONS` matrix, and all exported functions
2. `{core}/types/organization-context.ts` — how roles are carried through the system (field name and type)
3. `{backend}/lib/context.ts` — the `AuthContext` shape (how roles arrive from the middleware)

The patterns below are **structural conventions** — adapt the actual role names, permission names, field names, and function signatures to match what you find in the project. Never assume role names.

## Authorization Service Structure

The authorization service is a **pure module** in the core layer — no dependency injection, no side effects. It exports types, constants, and pure functions.

### Role Type

The project defines its own role union type. Role names vary per project — discover them by reading the source.

```typescript
// {core}/services/authorization.ts — read the actual file to find the real roles
export type {RoleType} = 'role_a' | 'role_b' | 'role_c' // project-specific
```

### Permission Format

Permissions follow the `resource:action` convention:

```typescript
export type Permission =
  | 'resource_a:read' | 'resource_a:write' | 'resource_a:delete'
  | 'resource_b:read' | 'resource_b:write'
  // ... project defines its own set
```

### Role-Permission Matrix

Each role maps to an explicit list of permissions. The matrix structure is always `Record<{RoleType}, readonly Permission[]>`, but the contents are project-specific. **Read the actual matrix** — do not assume which roles have which permissions.

```typescript
export const ROLE_PERMISSIONS: Record<{RoleType}, readonly Permission[]> = {
  role_a: [ /* ... read the actual file ... */ ],
  role_b: [ /* ... */ ],
  role_c: [ /* ... */ ],
}
```

### Core Functions

Projects may export some or all of these. Read the actual exports to know what's available.

```typescript
// Multi-role: hasPermission checks if ANY of the user's roles grants the permission.
export const hasPermission = (roles: {RoleType}[], permission: Permission): boolean => {
  return roles.some((role) => ROLE_PERMISSIONS[role]?.includes(permission) ?? false)
}

// Union of all permissions across the user's roles
export const getPermissions = (role: {RoleType}): readonly Permission[] => {
  return ROLE_PERMISSIONS[role] ?? []
}

// Validate a string is a valid role
export const isValidRole = (value: string): value is {RoleType} => {
  return VALID_ROLES.includes(value as {RoleType})
}
```

Some projects also have role parsing (e.g., from comma-separated DB strings) and role hierarchy functions. Check the exports.

## Use Case Pattern

Authorization is checked via direct import — `hasPermission` is a pure function, not an injected dependency. The input field that carries roles comes from `OrganizationContext` — read it to find the actual field name (e.g., `roles`, `memberRoles`, `memberRole`).

```typescript
import { hasPermission } from '{core}/services/authorization'
import { errAsync } from 'neverthrow'

// 1. Authorization check FIRST — before any business logic or DB calls
if (!hasPermission(input.{rolesField}, '{resource}:write')) {
  return errAsync({
    type: 'forbidden',
    message: 'Insufficient permissions',
  })
}

// 2. Business logic after authorization passes
```

## Procedure Pattern

The procedure passes member info from the authenticated context to the use case. Read `{backend}/lib/context.ts` to find the actual field path (e.g., `context.membership.roles`).

```typescript
export const update{Entity} = authProcedure
  .errors({
    FORBIDDEN: { message: 'Insufficient permissions' },
    NOT_FOUND: { message: '{Entity} not found' },
  })
  .input(update{Entity}InputSchema)
  .output({entity}Schema)
  .handler(async ({ input, context, errors }) => {
    const result = await makeUpdate{Entity}({
      {entity}Repository: create{Entity}Repository(context.db),
    })({
      organizationId: context.organization.id,
      {rolesField}: context.membership.{rolesField},  // read context.ts for actual path
      {entity}Id: input.id,
      data: input,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'not_found':
          throw errors.NOT_FOUND()
        case 'repository_error':
          console.error('Repository error:', result.error.cause)
          throw new Error('Internal error')
      }
    }

    return result.value
  })
```

## Migrating the Role Model

When refactoring roles (renaming, adding, removing, changing from single-role to multi-role):

### 1. Understand Permission Semantics, Not Names

When mapping old roles to new roles, **match by permissions, not by name**. A role rename isn't always a 1:1 mapping — the new role with a similar name might have completely different permissions.

Before migrating tests or use cases:
1. Read the **old** `ROLE_PERMISSIONS` matrix (from git history or the plan)
2. Read the **new** `ROLE_PERMISSIONS` matrix (from `authorization.ts`)
3. For each old role used in tests, find the new role whose **permissions** match what the test expects — not the role whose **name** sounds similar

Example: if old `admin` had write permissions and new `manager` does NOT have write permissions, then tests using `admin` for write-access scenarios should NOT use `manager` — they should use whichever new role has those write permissions.

### 2. Migration Checklist

- [ ] Read the new authorization service to understand the actual role type, permissions, and functions
- [ ] Update `OrganizationContext` type (core) — field name and type
- [ ] Update `AuthContext` type (backend) — field name and type
- [ ] Update auth middleware — role parsing/validation
- [ ] Update contracts — role schema if it exists
- [ ] Update all use cases — `hasPermission` call site (field name in input)
- [ ] Update all procedures — context extraction (field name from context)
- [ ] Update test context factories — map old roles to new roles **by permission semantics**
- [ ] Update all test files — use the correct context factory per test scenario
- [ ] Verify: `typecheck`, `lint`, `test` all pass
- [ ] Verify: grep for old role names/field names returns zero results

## Adding New Permissions

When adding a new resource to the system:

1. Add permissions to the `Permission` type in `{core}/services/authorization.ts`
2. Assign them to roles in `ROLE_PERMISSIONS` — follow **principle of least privilege**
3. Use `hasPermission` in the use case as the first check

## Common Violations

**1. Missing authorization check** — use case performs business logic without checking permissions first.

**2. Authorization after business logic** — permission check happens inside a `.andThen()` chain after a DB call. Check **before** any work.

**3. Passing raw role string instead of parsed roles** — if roles come as a comma-separated string from the DB, parse them before passing to `hasPermission`.

**4. Missing FORBIDDEN error in procedure** — any procedure calling an authorized use case needs `FORBIDDEN` in its `.errors()` definition.

**5. Role mapping by name instead of permissions** — when migrating roles, using name similarity (`admin` → `manager`) instead of checking which new role actually has the permissions the code expects.

## Test Context Factories

Test helpers typically provide factory functions for creating contexts with specific roles. When these exist, the role used by each factory must match the **permission set** needed by the test scenario:

- Happy-path tests for write operations → use a factory whose role has write permissions
- Forbidden tests → use a factory whose role lacks the required permission
- Multi-role tests → use a factory that accepts a roles array

Always read `{backend}/__tests__/helpers/test-context.ts` (or equivalent) to discover available factories and which roles they use.

## Best Practices

1. **Authorization first** — Check permissions before any business logic or database calls
2. **Pure functions** — Authorization service has no side effects, no DI needed
3. **Principle of least privilege** — Default unknown roles to zero permissions
4. **Explicit deny** — If a permission isn't in the role's list, it's denied
5. **Typed roles** — Never use raw strings for roles; use the project's role type
6. **Multi-role union** — When a user has multiple roles, permissions are the union of all roles
7. **Read the project** — Always read the project's actual authorization service before implementing; never assume role names or permissions
8. **Map by permissions** — When migrating roles, match old → new by permission sets, not by name similarity

## Cross-References

| Skill | Relationship |
|-------|-------------|
| `/clean-architecture` | Authorization is a step in the inside-out pipeline |
| `/use-case` | Authorization checks live inside use cases |
| `/procedure` | Procedures pass roles from context and map `FORBIDDEN` errors |
| `/domain` | Domain entities define what needs protecting; authorization decides who can act |
| `/port` | Ports don't know about authorization — that's a use case concern |
