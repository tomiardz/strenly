import { getLogBySessionInputSchema, getLogBySessionOutputSchema } from '@strenly/contracts/workout-logs/list-logs'
import { createWorkoutLogRepository } from '../../infrastructure/repositories/workout-log.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeGetLogBySession } from '../../use-cases/workout-logs/get-log-by-session'
import { mapLogToOutput } from './map-log-to-output'

/**
 * Get a workout log by athlete, session, and week combination.
 * Returns null if no log exists (used for get-or-create logic).
 */
export const getLogBySession = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to view workout logs' },
    INTERNAL_ERROR: { message: 'Internal server error' },
  })
  .input(getLogBySessionInputSchema)
  .output(getLogBySessionOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const useCase = makeGetLogBySession({
      workoutLogRepository: createWorkoutLogRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      athleteId: input.athleteId,
      sessionId: input.sessionId,
      weekId: input.weekId,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'getLogBySession' })
          throw errors.INTERNAL_ERROR({ message: 'Database access error' })
      }
    }

    // Return null if not found, or mapped log if found
    return result.value ? mapLogToOutput(result.value) : null
  })
