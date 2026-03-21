import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { useEffect } from 'react'
import { OrganizationProvider } from '@/contexts/organization-context'
import { setCurrentOrgSlug } from '@/lib/api-client'

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

    return { org }
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
