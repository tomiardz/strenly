import { createLogInputSchema, createLogOutputSchema } from '@strenly/contracts/workout-logs/create-log'
import { createAthleteRepository } from '../../infrastructure/repositories/athlete.repository'
import { createProgramRepository } from '../../infrastructure/repositories/program.repository'
import { createWorkoutLogRepository } from '../../infrastructure/repositories/workout-log.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeCreateLog } from '../../use-cases/workout-logs/create-log'
import { mapLogToOutput } from './map-log-to-output'

/**
 * Create a new workout log from program prescription.
 * Returns pre-filled log for client-side editing (NOT persisted).
 */
export const createLog = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to log workouts' },
    LOG_ALREADY_EXISTS: { message: 'Workout log already exists for this session and week' },
    PROGRAM_NOT_FOUND: { message: 'Program not found' },
    SESSION_NOT_FOUND: { message: 'Session not found' },
    WEEK_NOT_FOUND: { message: 'Week not found' },
    VALIDATION_ERROR: { message: 'Invalid log data' },
    INTERNAL_ERROR: { message: 'Internal server error' },
  })
  .input(createLogInputSchema)
  .output(createLogOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const useCase = makeCreateLog({
      workoutLogRepository: createWorkoutLogRepository(context.db),
      programRepository: createProgramRepository(context.db),
      athleteRepository: createAthleteRepository(context.db),
      generateId: () => crypto.randomUUID(),
    })

    const logDate = input.logDate ? new Date(input.logDate) : new Date()

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      athleteId: input.athleteId,
      programId: input.programId,
      sessionId: input.sessionId,
      weekId: input.weekId,
      logDate,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'log_already_exists':
          throw errors.LOG_ALREADY_EXISTS({
            message: `Workout log already exists for athlete ${result.error.athleteId}, session ${result.error.sessionId}, week ${result.error.weekId}`,
          })
        case 'program_not_found':
          throw errors.PROGRAM_NOT_FOUND({ message: `Program ${result.error.programId} not found` })
        case 'session_not_found':
          throw errors.SESSION_NOT_FOUND({ message: `Session ${result.error.sessionId} not found` })
        case 'week_not_found':
          throw errors.WEEK_NOT_FOUND({ message: `Week ${result.error.weekId} not found` })
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'createLog' })
          throw errors.INTERNAL_ERROR({ message: 'Database access error' })
      }
    }

    return mapLogToOutput(result.value)
  })
