import { Link, Outlet, createFileRoute, useMatchRoute } from '@tanstack/react-router'
import { UserIcon } from 'lucide-react'
import { useOrgSlug } from '@/hooks/use-org-slug'

const settingsNavItems = [{ path: 'profile', label: 'Mi Perfil', icon: UserIcon }]

export const Route = createFileRoute('/_authenticated/$orgSlug/settings')({
  component: SettingsLayout,
})

function SettingsLayout() {
  const matchRoute = useMatchRoute()
  const orgSlug = useOrgSlug()

  return (
    <div className="flex h-full">
      <aside className="w-60 shrink-0 border-r p-4">
        <h2 className="mb-4 font-semibold text-lg">Configuracion</h2>
        <nav className="flex flex-col gap-1">
          {settingsNavItems.map((item) => {
            const to = `/${orgSlug}/settings/${item.path}`
            const isActive = matchRoute({ to, fuzzy: true })
            return (
              <Link
                key={item.path}
                to={to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-accent font-semibold text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                }`}
              >
                <item.icon className="size-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">
        <Outlet />
      </main>
    </div>
  )
}
