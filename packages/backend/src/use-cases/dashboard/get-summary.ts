import type { AthleteRepositoryPort } from '@strenly/core/ports/athlete-repository.port'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import type { RecentActivityEntry, WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { ResultAsync, errAsync } from 'neverthrow'

// ============================================================================
// Types
// ============================================================================

export type GetSummaryInput = OrganizationContext

export type DashboardSummary = {
  totalAthletes: number
  activeAthletes: number
  programsByStatus: { draft: number; active: number; archived: number }
  sessionsCompletedThisWeek: number
  recentActivity: RecentActivityEntry[]
}

export type GetSummaryError =
  | { type: 'forbidden'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  athleteRepository: AthleteRepositoryPort
  programRepository: ProgramRepositoryPort
  workoutLogRepository: WorkoutLogRepositoryPort
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Get the most recent Monday at 00:00:00 UTC.
 * If today is Monday, returns today at 00:00:00 UTC.
 */
function getStartOfWeek(): Date {
  const now = new Date()
  const day = now.getUTCDay()
  // day 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  // Days since Monday: (day + 6) % 7
  const daysSinceMonday = (day + 6) % 7
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday))
  return monday
}

// ============================================================================
// Use Case
// ============================================================================

export const makeGetDashboardSummary =
  (deps: Dependencies) =>
  (input: GetSummaryInput): ResultAsync<DashboardSummary, GetSummaryError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'athletes:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to view dashboard summary',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }
    const startOfWeek = getStartOfWeek()

    // 2. Execute all queries in parallel
    return ResultAsync.combine([
      deps.athleteRepository.count(ctx).mapErr(
        (e): GetSummaryError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Failed to count athletes',
        }),
      ),
      deps.athleteRepository.count(ctx, { status: 'active' }).mapErr(
        (e): GetSummaryError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Failed to count active athletes',
        }),
      ),
      deps.programRepository.countByStatus(ctx).mapErr(
        (e): GetSummaryError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Failed to count programs by status',
        }),
      ),
      deps.workoutLogRepository.countCompletedSince(ctx, startOfWeek).mapErr(
        (e): GetSummaryError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Failed to count completed sessions',
        }),
      ),
      deps.workoutLogRepository.listRecent(ctx, 10).mapErr(
        (e): GetSummaryError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Failed to list recent activity',
        }),
      ),
    ]).map(([totalAthletes, activeAthletes, programsByStatus, sessionsCompletedThisWeek, recentActivity]) => ({
      totalAthletes,
      activeAthletes,
      programsByStatus,
      sessionsCompletedThisWeek,
      recentActivity,
    }))
  }
