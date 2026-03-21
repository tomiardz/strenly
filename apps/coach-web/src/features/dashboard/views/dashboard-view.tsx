import { AlertCircle } from 'lucide-react'
import { QuickActions } from '../components/quick-actions'
import { RecentActivity } from '../components/recent-activity'
import { StatsCards } from '../components/stats-cards'
import { useDashboardStats } from '../hooks/use-dashboard-stats'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useOrganization } from '@/contexts/organization-context'

/**
 * Dashboard view component.
 * Main landing page after authentication showing organization overview.
 */
export function DashboardView() {
  const org = useOrganization()
  const { data, isLoading, isError, refetch } = useDashboardStats()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-bold text-3xl tracking-tight">Bienvenido, {org.name}</h1>
        <p className="text-muted-foreground">Aqui tienes un resumen de tu organizacion</p>
      </div>

      {isError ? (
        <Card>
          <CardContent className="flex items-center gap-4 py-6">
            <AlertCircle className="h-5 w-5 text-destructive" />
            <div className="flex-1">
              <p className="font-medium">Error al cargar el resumen</p>
              <p className="text-muted-foreground text-sm">No se pudieron obtener las estadísticas del dashboard.</p>
            </div>
            <Button variant="outline" onClick={() => refetch()}>
              Reintentar
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <StatsCards data={data} isLoading={isLoading} />

          <div className="grid gap-6 lg:grid-cols-2">
            <RecentActivity activities={data?.recentActivity ?? []} isLoading={isLoading} />
            <QuickActions />
          </div>
        </>
      )}
    </div>
  )
}
