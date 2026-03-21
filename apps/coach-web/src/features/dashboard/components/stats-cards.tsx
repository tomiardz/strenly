import type { DashboardSummaryOutput } from '@strenly/contracts/dashboard/summary'
import { Calendar, FileEdit, PlayCircle, UserCheck, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

interface StatsCardsProps {
  data: DashboardSummaryOutput | undefined
  isLoading: boolean
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  description: string
  isLoading: boolean
}

function StatCard({ icon: Icon, label, value, description, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="font-medium text-muted-foreground text-sm">{label}</CardTitle>
        <Icon className="h-4 w-4 text-primary" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="mb-2 h-8 w-20" />
            <Skeleton className="h-4 w-32" />
          </>
        ) : (
          <>
            <div className="font-bold text-3xl tabular-nums">{value}</div>
            <p className="text-muted-foreground text-xs">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Dashboard stats cards component.
 * Displays total athletes, active athletes, draft/active programs, and sessions this week.
 */
export function StatsCards({ data, isLoading }: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <StatCard
        icon={Users}
        label="Total de atletas"
        value={data?.totalAthletes ?? 0}
        description="en tu organizacion"
        isLoading={isLoading}
      />
      <StatCard
        icon={UserCheck}
        label="Atletas activos"
        value={data?.activeAthletes ?? 0}
        description="entrenando actualmente"
        isLoading={isLoading}
      />
      <StatCard
        icon={FileEdit}
        label="Programas borrador"
        value={data?.programsByStatus.draft ?? 0}
        description="en preparacion"
        isLoading={isLoading}
      />
      <StatCard
        icon={PlayCircle}
        label="Programas activos"
        value={data?.programsByStatus.active ?? 0}
        description="en ejecucion"
        isLoading={isLoading}
      />
      <StatCard
        icon={Calendar}
        label="Sesiones esta semana"
        value={data?.sessionsCompletedThisWeek ?? 0}
        description="completadas"
        isLoading={isLoading}
      />
    </div>
  )
}
