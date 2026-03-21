import { z } from 'zod'

/**
 * Organization member roles (multi-role model)
 * - owner: Full control of organization
 * - manager: Org management, members, billing (no coaching)
 * - coach: Athlete/program/exercise/workout management
 * - athlete: Self-access only (programs:read, workout logs)
 */
export const organizationRoleSchema = z.enum(['owner', 'manager', 'coach', 'athlete'], {
  error: 'Rol de organización inválido',
})
export type OrganizationRole = z.infer<typeof organizationRoleSchema>
