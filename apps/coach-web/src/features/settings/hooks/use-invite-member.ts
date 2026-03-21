import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/organization-context'
import { authClient } from '@/lib/auth-client'
import { toast } from '@/lib/toast'

type StrenlyRole = 'coach' | 'manager' | 'owner'
type BetterAuthRole = 'member' | 'admin' | 'owner'

const STRENLY_TO_BETTER_AUTH_ROLE: Record<StrenlyRole, BetterAuthRole> = {
  coach: 'member',
  manager: 'admin',
  owner: 'owner',
}

/**
 * Hook to invite a member to the organization via Better-Auth.
 * Calls authClient.organization.createInvitation and invalidates members query on success.
 */
export function useInviteMember() {
  const org = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { email: string; role: StrenlyRole }) => {
      const result = await authClient.organization.inviteMember({
        email: data.email,
        role: STRENLY_TO_BETTER_AUTH_ROLE[data.role],
        organizationId: org.id,
      })

      if (result.error) {
        throw new Error(result.error.message ?? 'Error al enviar la invitacion')
      }

      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', org.id, 'members'] })
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Error al enviar la invitacion'
      toast.error(message)
    },
  })
}
