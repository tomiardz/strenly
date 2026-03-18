export type Role = 'owner' | 'admin' | 'member'

export type Permission =
  // Organization management
  | 'organization:read'
  | 'organization:manage'
  | 'organization:delete'
  // Members
  | 'members:read'
  | 'members:invite'
  | 'members:remove'
  | 'members:update-role'
  // Billing/Subscription
  | 'billing:read'
  | 'billing:manage'
  // Athletes
  | 'athletes:read'
  | 'athletes:write'
  | 'athletes:delete'
  // Programs
  | 'programs:read'
  | 'programs:write'
  | 'programs:delete'
  // Exercises
  | 'exercises:read'
  | 'exercises:write'
  // Workout Logs
  | 'workout_log:create'
  | 'workout_log:read'
  | 'workout_log:update'
  | 'workout_log:delete'

const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 100,
  admin: 80,
  member: 40,
}

const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  owner: [
    // Organization
    'organization:read',
    'organization:manage',
    'organization:delete',
    // Members
    'members:read',
    'members:invite',
    'members:remove',
    'members:update-role',
    // Billing
    'billing:read',
    'billing:manage',
    // Athletes
    'athletes:read',
    'athletes:write',
    'athletes:delete',
    // Programs
    'programs:read',
    'programs:write',
    'programs:delete',
    // Exercises
    'exercises:read',
    'exercises:write',
    // Workout Logs
    'workout_log:create',
    'workout_log:read',
    'workout_log:update',
    'workout_log:delete',
  ],
  admin: [
    // Organization (no delete)
    'organization:read',
    'organization:manage',
    // Members (can invite/remove but not change roles)
    'members:read',
    'members:invite',
    'members:remove',
    // Billing (read only)
    'billing:read',
    // Athletes
    'athletes:read',
    'athletes:write',
    'athletes:delete',
    // Programs
    'programs:read',
    'programs:write',
    'programs:delete',
    // Exercises
    'exercises:read',
    'exercises:write',
    // Workout Logs
    'workout_log:create',
    'workout_log:read',
    'workout_log:update',
    'workout_log:delete',
  ],
  member: [
    // Organization (read only)
    'organization:read',
    // Members (read only)
    'members:read',
    // Athletes (can write but not delete)
    'athletes:read',
    'athletes:write',
    // Programs (read only for members)
    'programs:read',
    // Exercises (read only for members)
    'exercises:read',
    // Workout Logs (read only for members)
    'workout_log:read',
  ],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role]
  return permissions?.includes(permission) ?? false
}

export function getPermissions(role: Role): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

export function hasHigherOrEqualRole(role: Role, targetRole: Role): boolean {
  const roleLevel = ROLE_HIERARCHY[role] ?? 0
  const targetLevel = ROLE_HIERARCHY[targetRole] ?? 0
  return roleLevel >= targetLevel
}

export function isValidRole(role: string): role is Role {
  return role === 'owner' || role === 'admin' || role === 'member'
}
