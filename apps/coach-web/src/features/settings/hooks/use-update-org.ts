import { useState } from 'react'
import { useOrganization } from '@/contexts/organization-context'
import { clearAuthCache } from '@/lib/auth-cache'
import { authClient } from '@/lib/auth-client'
import { toast } from '@/lib/toast'

/**
 * Hook for updating organization details.
 * Follows the same useState pattern as profile-view.tsx.
 */
export function useUpdateOrg() {
  const org = useOrganization()
  const [isPending, setIsPending] = useState(false)

  const updateOrg = async (data: { name: string }) => {
    setIsPending(true)
    try {
      const result = await authClient.organization.update({
        data: { name: data.name },
        organizationId: org.id,
      })

      if (result.error) {
        toast.error('Error al actualizar la organizacion. Intenta de nuevo.')
        setIsPending(false)
        return
      }

      clearAuthCache()
      toast.success('Organizacion actualizada correctamente')
      setIsPending(false)
    } catch {
      toast.error('Error al actualizar la organizacion. Intenta de nuevo.')
      setIsPending(false)
    }
  }

  return { updateOrg, isPending }
}
