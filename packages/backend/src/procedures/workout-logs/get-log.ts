import { getLogInputSchema, getLogOutputSchema } from '@strenly/contracts/workout-logs/list-logs'
import { createWorkoutLogRepository } from '../../infrastructure/repositories/workout-log.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeGetLog } from '../../use-cases/workout-logs/get-log'
import { mapLogToOutput } from './map-log-to-output'

/**
 * Get a workout log by ID.
 */
export const getLog = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to view workout logs' },
    NOT_FOUND: { message: 'Workout log not found' },
    INTERNAL_ERROR: { message: 'Internal server error' },
  })
  .input(getLogInputSchema)
  .output(getLogOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const useCase = makeGetLog({
      workoutLogRepository: createWorkoutLogRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      logId: input.logId,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'not_found':
          throw errors.NOT_FOUND({ message: `Workout log ${result.error.logId} not found` })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'getLog' })
          throw errors.INTERNAL_ERROR({ message: 'Database access error' })
      }
    }

    return mapLogToOutput(result.value)
  })
