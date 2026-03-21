import { dashboardSummaryOutputSchema } from '@strenly/contracts/dashboard/summary'
import { createAthleteRepository } from '../../infrastructure/repositories/athlete.repository'
import { createProgramRepository } from '../../infrastructure/repositories/program.repository'
import { createWorkoutLogRepository } from '../../infrastructure/repositories/workout-log.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeGetDashboardSummary } from '../../use-cases/dashboard/get-summary'

/**
 * Dashboard summary procedure
 * Returns aggregated stats and recent activity for the coach dashboard
 */
export const summary = authProcedure
  .output(dashboardSummaryOutputSchema)
  .errors({
    FORBIDDEN: { message: 'No permission to view dashboard summary' },
  })
  .handler(async ({ context, errors }) => {
    const useCase = makeGetDashboardSummary({
      athleteRepository: createAthleteRepository(context.db),
      programRepository: createProgramRepository(context.db),
      workoutLogRepository: createWorkoutLogRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'dashboard.summary' })
          throw new Error('Internal error')
      }
    }

    const value = result.value

    return {
      totalAthletes: value.totalAthletes,
      activeAthletes: value.activeAthletes,
      programsByStatus: value.programsByStatus,
      sessionsCompletedThisWeek: value.sessionsCompletedThisWeek,
      recentActivity: value.recentActivity.map((entry) => ({
        id: entry.id,
        athleteName: entry.athleteName,
        sessionName: entry.sessionName,
        programName: entry.programName,
        logDate: entry.logDate.toISOString(),
        status: entry.status,
      })),
    }
  })
