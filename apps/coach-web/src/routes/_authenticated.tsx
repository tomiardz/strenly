import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { Loader2Icon } from 'lucide-react'
import { AppShell } from '@/components/layout/app-shell'
import { AuthProvider } from '@/contexts/auth-context'
import type { OrganizationContextValue } from '@/contexts/organization-context'
import { clearAuthCache, getCachedAuth, setCachedAuth } from '@/lib/auth-cache'
import { authClient } from '@/lib/auth-client'

export { clearAuthCache }

export const Route = createFileRoute('/_authenticated')({
  pendingComponent: AuthenticatedPending,
  beforeLoad: async () => {
    // Use cached auth if available and fresh
    const cached = getCachedAuth()
    if (cached) {
      return { authData: cached.session, organizations: cached.organizations }
    }

    // Fetch session and organizations
    const sessionData = await authClient.getSession()
    if (!sessionData.data) {
      throw redirect({ to: '/login' })
    }

    const orgsResult = await authClient.organization.list()
    const organizations = (orgsResult.data ?? []).map((org) => {
      const rawMeta = org.metadata
      const metadata: OrganizationContextValue['metadata'] =
        rawMeta && typeof rawMeta === 'object' && !Array.isArray(rawMeta)
          ? {
              type: 'type' in rawMeta && typeof rawMeta.type === 'string' ? rawMeta.type : undefined,
              status: 'status' in rawMeta && typeof rawMeta.status === 'string' ? rawMeta.status : undefined,
            }
          : null

      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        logo: org.logo,
        role: 'role' in org && typeof org.role === 'string' ? org.role : 'member',
        metadata,
      }
    })

    // Cache the auth data
    setCachedAuth(sessionData.data, organizations)

    return { authData: sessionData.data, organizations }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedPending() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2Icon className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  )
}

function AuthenticatedLayout() {
  const { authData } = Route.useRouteContext()

  return (
    <AuthProvider value={authData}>
      <AppShell authData={authData}>
        <Outlet />
      </AppShell>
    </AuthProvider>
  )
}
