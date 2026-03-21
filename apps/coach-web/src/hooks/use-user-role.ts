import { useOrganization } from '@/contexts/organization-context'
import { hasPermission, isValidRole } from '@strenly/core/services/authorization'

/**
 * Hook to get the current user's role in the active organization
 * and derive permission booleans.
 */
export function useUserRole() {
  const { role } = useOrganization()

  const validRole = isValidRole(role) ? role : undefined
  const canManageOrg = validRole ? hasPermission([validRole], 'organization:manage') : false

  return { role, canManageOrg }
}
