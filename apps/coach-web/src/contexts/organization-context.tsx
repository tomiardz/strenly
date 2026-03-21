import { createContext, type ReactNode, useContext } from 'react'

/**
 * Organization context value type.
 * Matches the org object shape from authClient.organization.list().
 */
export type OrganizationContextValue = {
  id: string
  name: string
  slug: string
  logo?: string | null
  role: string
  metadata?: {
    type?: string
    status?: string
  } | null
}

const OrganizationContext = createContext<OrganizationContextValue | null>(null)

interface OrganizationProviderProps {
  value: OrganizationContextValue
  children: ReactNode
}

/**
 * Provider component for organization context.
 * Caches org data fetched in $orgSlug beforeLoad to avoid redundant API calls.
 */
export function OrganizationProvider({ value, children }: OrganizationProviderProps) {
  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>
}

/**
 * Hook to access organization context.
 * Throws if used outside OrganizationProvider to ensure type safety.
 */
export function useOrganization(): OrganizationContextValue {
  const context = useContext(OrganizationContext)
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}

/**
 * Hook to access organization context without throwing.
 * Returns null when used outside OrganizationProvider.
 * Useful for components that render above the provider (e.g., sidebar in _authenticated layout).
 */
export function useOptionalOrganization(): OrganizationContextValue | null {
  return useContext(OrganizationContext)
}
