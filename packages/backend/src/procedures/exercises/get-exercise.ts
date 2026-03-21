import { exerciseSchema, getExerciseInputSchema } from '@strenly/contracts/exercises/exercise'
import { createExerciseRepository } from '../../infrastructure/repositories/exercise.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeGetExercise } from '../../use-cases/exercises/get-exercise'
import { mapExerciseToOutput } from './map-exercise-to-output'

/**
 * Get a single exercise by ID
 * Requires authentication and exercises:read permission
 * Returns curated or organization's custom exercises
 */
export const getExercise = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to view exercises' },
    NOT_FOUND: { message: 'Exercise not found' },
  })
  .input(getExerciseInputSchema)
  .output(exerciseSchema)
  .handler(async ({ input, context, errors }) => {
    const getExerciseUseCase = makeGetExercise({
      exerciseRepository: createExerciseRepository(context.db),
    })

    const result = await getExerciseUseCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      exerciseId: input.exerciseId,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'not_found':
          throw errors.NOT_FOUND({ message: `Exercise not found: ${result.error.exerciseId}` })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'getExercise' })
          throw new Error('Internal error')
      }
    }

    const exercise = result.value

    return mapExerciseToOutput(exercise)
  })
