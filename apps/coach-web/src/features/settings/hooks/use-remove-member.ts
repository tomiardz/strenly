import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/organization-context'
import { authClient } from '@/lib/auth-client'
import { toast } from '@/lib/toast'

/**
 * Hook to remove a member from the organization via Better-Auth.
 * Calls authClient.organization.removeMember and invalidates members query on success.
 */
export function useRemoveMember() {
  const org = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (memberIdOrEmail: string) => {
      const result = await authClient.organization.removeMember({
        memberIdOrEmail,
        organizationId: org.id,
      })

      if (result.error) {
        throw new Error(result.error.message ?? 'Error al eliminar al miembro')
      }

      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', org.id, 'members'] })
      toast.success('Miembro eliminado')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Error al eliminar al miembro'
      toast.error(message)
    },
  })
}
