import { Link, useMatches } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { useOrgSlug } from '@/hooks/use-org-slug'

const routeLabels: Record<string, string> = {
  dashboard: 'Panel',
  athletes: 'Atletas',
  exercises: 'Ejercicios',
  settings: 'Configuracion',
  profile: 'Mi Perfil',
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function Breadcrumbs() {
  const matches = useMatches()
  const orgSlug = useOrgSlug()

  // Build breadcrumb items from route matches
  const breadcrumbs = matches
    .filter((match) => match.pathname !== '/')
    .map((match) => {
      const segments = match.pathname.split('/').filter(Boolean)
      const lastSegment = segments[segments.length - 1]

      const label = routeLabels[lastSegment] ?? capitalizeFirst(lastSegment ?? '')

      return {
        pathname: match.pathname,
        label,
        segment: lastSegment,
      }
    })
    // Filter out layout routes and the orgSlug segment
    .filter(
      (item) => item.label && item.label !== '_authenticated' && item.label !== '_auth' && item.segment !== orgSlug,
    )

  // Check if we're on the dashboard page
  const isOnDashboard = breadcrumbs.length === 1 && breadcrumbs[0]?.segment === 'dashboard'

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {/* Home breadcrumb - always first */}
        <BreadcrumbItem>
          {isOnDashboard ? (
            <BreadcrumbPage>Inicio</BreadcrumbPage>
          ) : (
            <BreadcrumbLink render={<Link to="/$orgSlug/dashboard" params={{ orgSlug }} />}>Inicio</BreadcrumbLink>
          )}
        </BreadcrumbItem>

        {/* Remaining breadcrumbs after "Inicio", excluding dashboard */}
        {breadcrumbs
          .filter((item) => item.segment !== 'dashboard')
          .map((item, index, arr) => {
            const isLast = index === arr.length - 1

            return (
              <div key={item.pathname} className="flex items-center gap-2">
                <BreadcrumbSeparator>
                  <ChevronRightIcon className="size-4" />
                </BreadcrumbSeparator>
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage>{item.label}</BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink render={<Link to={item.pathname} />}>{item.label}</BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </div>
            )
          })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
