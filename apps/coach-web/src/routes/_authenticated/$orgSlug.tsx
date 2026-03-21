import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { OrganizationProvider } from '@/contexts/organization-context'
import { setCurrentOrgSlug } from '@/lib/api-client'
import { authClient } from '@/lib/auth-client'

export const Route = createFileRoute('/_authenticated/$orgSlug')({
  beforeLoad: async ({ params, context, location }) => {
    // Get organizations from parent _authenticated route (already cached)
    const organizations = context.organizations
    const org = organizations.find((o) => o.slug === params.orgSlug)

    if (!org) {
      throw redirect({ to: '/onboarding' })
    }

    // Redirect /$orgSlug to /$orgSlug/dashboard
    if (location.pathname === `/${params.orgSlug}`) {
      throw redirect({ to: '/$orgSlug/dashboard', params: { orgSlug: params.orgSlug } })
    }

    // Set org slug for API client immediately (available before component renders)
    setCurrentOrgSlug(params.orgSlug)

    // Fetch the user's role in this organization
    const userId = context.authData.user.id
    const fullOrgResult = await authClient.organization.getFullOrganization({
      query: { organizationId: org.id },
    })
    const currentMember = fullOrgResult.data?.members?.find((m) => m.userId === userId)
    const role = currentMember?.role ?? 'member'

    return { org: { ...org, role } }
  },
  component: OrgSlugLayout,
})

function OrgSlugLayout() {
  const { org } = Route.useRouteContext()

  // Cleanup org slug on unmount (navigating away from org scope)
  useEffect(() => {
    return () => setCurrentOrgSlug(null)
  }, [])

  return (
    <OrganizationProvider value={org}>
      <Outlet />
    </OrganizationProvider>
  )
}
