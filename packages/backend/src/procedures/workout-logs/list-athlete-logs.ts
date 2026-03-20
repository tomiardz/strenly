import { listAthleteLogsOutputSchema, listAthleteLogsQuerySchema } from '@strenly/contracts/workout-logs/list-logs'
import { createWorkoutLogRepository } from '../../infrastructure/repositories/workout-log.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeListAthleteLogs } from '../../use-cases/workout-logs/list-athlete-logs'
import { mapLogToOutput } from './map-log-to-output'

/**
 * List workout logs for an athlete with filters and pagination.
 */
export const listAthleteLogs = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to view workout logs' },
    INTERNAL_ERROR: { message: 'Internal server error' },
  })
  .input(listAthleteLogsQuerySchema)
  .output(listAthleteLogsOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const useCase = makeListAthleteLogs({
      workoutLogRepository: createWorkoutLogRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      athleteId: input.athleteId,
      status: input.status,
      fromDate: input.fromDate ? new Date(input.fromDate) : undefined,
      toDate: input.toDate ? new Date(input.toDate) : undefined,
      limit: input.limit,
      offset: input.offset,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'listAthleteLogs' })
          throw errors.INTERNAL_ERROR({ message: 'Database access error' })
      }
    }

    return {
      items: result.value.items.map(mapLogToOutput),
      totalCount: result.value.totalCount,
    }
  })
