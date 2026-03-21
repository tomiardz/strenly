import { useQuery } from '@tanstack/react-query'
import { useOrganization } from '@/contexts/organization-context'
import { authClient } from '@/lib/auth-client'

/**
 * Hook for fetching organization members via Better-Auth's getFullOrganization.
 * Returns the members array with nested user objects.
 */
export function useOrgMembers() {
  const org = useOrganization()

  const { data, isLoading, error } = useQuery({
    queryKey: ['organization', org.id, 'members'],
    queryFn: async () => {
      const result = await authClient.organization.getFullOrganization({
        query: { organizationId: org.id },
      })

      if (result.error) {
        throw new Error('Error al cargar los miembros de la organizacion')
      }

      return result.data
    },
  })

  return {
    members: data?.members ?? [],
    isLoading,
    error,
  }
}
