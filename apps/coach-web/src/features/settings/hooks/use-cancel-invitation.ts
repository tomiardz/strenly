import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/organization-context'
import { authClient } from '@/lib/auth-client'
import { toast } from '@/lib/toast'

/**
 * Hook to cancel a pending invitation via Better-Auth.
 * Calls authClient.organization.cancelInvitation and invalidates members query on success.
 */
export function useCancelInvitation() {
  const org = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await authClient.organization.cancelInvitation({
        invitationId,
      })

      if (result.error) {
        throw new Error(result.error.message ?? 'Error al cancelar la invitacion')
      }

      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', org.id, 'members'] })
      toast.success('Invitacion cancelada')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Error al cancelar la invitacion'
      toast.error(message)
    },
  })
}
