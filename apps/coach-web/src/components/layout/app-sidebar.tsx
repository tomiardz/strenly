import { Link, useMatchRoute, useNavigate } from '@tanstack/react-router'
import {
  CopyIcon,
  DumbbellIcon,
  FileTextIcon,
  HelpCircleIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  MoreVerticalIcon,
  SettingsIcon,
  SunIcon,
  UsersIcon,
  ZapIcon,
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { useOrgSlug } from '@/hooks/use-org-slug'
import { signOut } from '@/lib/auth-client'
import { useTheme } from '@/lib/theme'

const mainNavItems = [
  { path: 'dashboard', label: 'Panel', icon: LayoutDashboardIcon },
  { path: 'athletes', label: 'Atletas', icon: UsersIcon },
  { path: 'programs', label: 'Programas', icon: FileTextIcon },
  { path: 'exercises', label: 'Ejercicios', icon: DumbbellIcon },
  { path: 'templates', label: 'Plantillas', icon: CopyIcon },
]

const settingsNavItems = [
  { path: 'settings', label: 'Configuracion', icon: SettingsIcon },
  { path: 'help', label: 'Centro de Ayuda', icon: HelpCircleIcon },
]

type AppSidebarProps = {
  user: {
    id: string
    name: string
    email: string
  }
}

export function AppSidebar({ user }: AppSidebarProps) {
  const matchRoute = useMatchRoute()
  const orgSlug = useOrgSlug()
  const navigate = useNavigate()
  const { theme, setTheme } = useTheme()

  const handleLogout = async () => {
    await signOut()
    navigate({ to: '/' })
  }

  const userInitials = user.name
    ? user.name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : (user.email?.[0]?.toUpperCase() ?? 'U')

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border border-r">
      <SidebarHeader className="h-16 border-sidebar-border border-b">
        <div className="flex h-full items-center gap-2 px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary">
            <ZapIcon className="size-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight group-data-[collapsible=icon]:hidden">STRENLY</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => {
                const to = `/${orgSlug}/${item.path}`
                const isActive = matchRoute({ to, fuzzy: true })
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      render={<Link to={to} />}
                      isActive={Boolean(isActive)}
                      size="lg"
                      className="gap-3 px-4 text-muted-foreground data-[active=true]:font-semibold data-[active=true]:text-primary"
                    >
                      <item.icon className="size-5" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="px-4 font-bold text-[10px] text-muted-foreground uppercase tracking-widest">
            Configuracion
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavItems.map((item) => {
                const to = `/${orgSlug}/${item.path}`
                const isActive = matchRoute({ to, fuzzy: true })
                return (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      render={<Link to={to} />}
                      isActive={Boolean(isActive)}
                      size="lg"
                      className="gap-3 px-4 text-muted-foreground data-[active=true]:font-semibold data-[active=true]:text-primary"
                    >
                      <item.icon className="size-5" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t p-4 group-data-[collapsible=icon]:p-2">
        <DropdownMenu>
          <DropdownMenuTrigger className="w-full outline-none">
            <div className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:p-0">
              <Avatar className="size-9">
                <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 text-left group-data-[collapsible=icon]:hidden">
                <p className="truncate font-semibold text-sm">{user.name ?? 'Usuario'}</p>
                <p className="truncate text-muted-foreground text-xs">{user.email}</p>
              </div>
              <MoreVerticalIcon className="size-4 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="font-medium text-sm leading-none">{user.name ?? 'Usuario'}</p>
                  <p className="text-muted-foreground text-xs leading-none">{user.email}</p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate({ to: '/$orgSlug/settings/profile', params: { orgSlug } })}>
                <SettingsIcon className="mr-2 size-4" />
                <span>Configuracion</span>
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <MonitorIcon className="mr-2 size-4" />
                  <span>Tema</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem onClick={() => setTheme('light')}>
                    <SunIcon className="mr-2 size-4" />
                    <span>Claro</span>
                    {theme === 'light' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <MoonIcon className="mr-2 size-4" />
                    <span>Oscuro</span>
                    {theme === 'dark' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')}>
                    <MonitorIcon className="mr-2 size-4" />
                    <span>Sistema</span>
                    {theme === 'system' && <span className="ml-auto">✓</span>}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOutIcon className="mr-2 size-4" />
              <span>Cerrar sesion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
