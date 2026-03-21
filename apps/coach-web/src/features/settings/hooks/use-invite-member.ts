import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/organization-context'
import { authClient } from '@/lib/auth-client'
import { toast } from '@/lib/toast'

/**
 * Hook to invite a member to the organization via Better-Auth.
 * Calls authClient.organization.createInvitation and invalidates members query on success.
 */
export function useInviteMember() {
  const org = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { email: string; role: string }) => {
      const result = await authClient.organization.createInvitation({
        email: data.email,
        role: data.role,
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
