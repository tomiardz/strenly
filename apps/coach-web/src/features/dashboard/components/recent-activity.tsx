import type { RecentActivity as RecentActivityEntry } from '@strenly/contracts/dashboard/summary'
import { Link } from '@tanstack/react-router'
import { formatDistanceToNow } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useOrgSlug } from '@/hooks/use-org-slug'

interface RecentActivityProps {
  activities: RecentActivityEntry[]
  isLoading: boolean
}

const STATUS_CONFIG = {
  completed: { label: 'Completada', variant: 'default' },
  partial: { label: 'Parcial', variant: 'secondary' },
  skipped: { label: 'Omitida', variant: 'destructive' },
} as const

/**
 * Recent activity component for the dashboard.
 * Shows the latest workout log entries across all athletes.
 */
export function RecentActivity({ activities, isLoading }: RecentActivityProps) {
  const orgSlug = useOrgSlug()

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Actividad reciente</CardTitle>
          <Link to="/$orgSlug/athletes" params={{ orgSlug }} className="text-muted-foreground text-sm hover:underline">
            Ver atletas
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-5 w-16" />
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-4 text-center">
            <p className="font-medium text-muted-foreground text-sm">No hay actividad reciente</p>
            <p className="text-muted-foreground text-xs">
              Los registros de entrenamiento de tus atletas aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const config = STATUS_CONFIG[activity.status]
              return (
                <div key={activity.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{activity.athleteName ?? 'Atleta desconocido'}</p>
                    <p className="text-muted-foreground text-sm">
                      {activity.sessionName ?? 'Sesión'}
                      {activity.programName ? ` · ${activity.programName}` : ''}
                      {' · '}
                      {formatDistanceToNow(new Date(activity.logDate), { addSuffix: true })}
                    </p>
                  </div>
                  <Badge variant={config.variant}>{config.label}</Badge>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
