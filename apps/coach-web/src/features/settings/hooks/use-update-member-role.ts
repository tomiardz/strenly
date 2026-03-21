import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/organization-context'
import { authClient } from '@/lib/auth-client'
import { toast } from '@/lib/toast'

/**
 * Hook to update a member's role in the organization via Better-Auth.
 * Calls authClient.organization.updateMemberRole and invalidates members query on success.
 */
export function useUpdateMemberRole() {
  const org = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { memberId: string; role: string }) => {
      const result = await authClient.organization.updateMemberRole({
        memberId: data.memberId,
        role: data.role,
        organizationId: org.id,
      })

      if (result.error) {
        throw new Error(result.error.message ?? 'Error al actualizar el rol')
      }

      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization', org.id, 'members'] })
      toast.success('Rol actualizado')
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Error al actualizar el rol'
      toast.error(message)
    },
  })
}
