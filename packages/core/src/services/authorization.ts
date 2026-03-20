export type OrganizationRole = 'owner' | 'manager' | 'coach' | 'athlete'

export const ORGANIZATION_ROLES: readonly OrganizationRole[] = [
  'owner',
  'manager',
  'coach',
  'athlete',
] as const

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

const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
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
  manager: [
    'organization:read',
    'organization:manage',
    'members:read',
    'members:invite',
    'members:remove',
    'billing:read',
    'athletes:read',
  ],
  coach: [
    'members:read',
    'athletes:read',
    'athletes:write',
    'athletes:delete',
    'programs:read',
    'programs:write',
    'programs:delete',
    'exercises:read',
    'exercises:write',
    'workout_log:create',
    'workout_log:read',
    'workout_log:update',
    'workout_log:delete',
  ],
  athlete: [
    'programs:read',
    'workout_log:create',
    'workout_log:read',
    'workout_log:update',
  ],
}

export function hasPermission(roles: OrganizationRole[], permission: Permission): boolean {
  return roles.some((role) => {
    const permissions = ROLE_PERMISSIONS[role]
    return permissions?.includes(permission) ?? false
  })
}

export function getPermissions(role: OrganizationRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role] ?? []
}

export function isValidRole(role: string): role is OrganizationRole {
  return ORGANIZATION_ROLES.includes(role as OrganizationRole)
}
