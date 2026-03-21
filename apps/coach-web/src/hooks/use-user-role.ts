import { hasPermission, isValidRole } from '@strenly/core/services/authorization'
import { useOrganization } from '@/contexts/organization-context'

/**
 * Hook to get the current user's role in the active organization
 * and derive permission booleans.
 */
export function useUserRole() {
  const { role } = useOrganization()

  const validRole = isValidRole(role) ? role : undefined
  const canManageOrg = validRole ? hasPermission([validRole], 'organization:manage') : false
  const canInviteMembers = validRole ? hasPermission([validRole], 'members:invite') : false
  const canUpdateRoles = validRole ? hasPermission([validRole], 'members:update-role') : false
  const canRemoveMembers = validRole ? hasPermission([validRole], 'members:remove') : false

  return { role, canManageOrg, canInviteMembers, canUpdateRoles, canRemoveMembers }
}
