import { type OrganizationRole, isValidRole } from '@strenly/core/services/authorization'

/**
 * Parses a comma-separated role string into validated OrganizationRole array.
 * Invalid values are silently discarded.
 */
export function parseRoles(roleString: string): OrganizationRole[] {
  return roleString
    .split(',')
    .map((s) => s.trim())
    .filter(isValidRole)
}
