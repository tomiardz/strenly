import { cloneExerciseInputSchema, exerciseSchema } from '@strenly/contracts/exercises/exercise'
import { createExerciseRepository } from '../../infrastructure/repositories/exercise.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeCloneExercise } from '../../use-cases/exercises/clone-exercise'
import { mapExerciseToOutput } from './map-exercise-to-output'

/**
 * Clone an exercise to create a custom copy
 * Requires authentication and exercises:write permission
 * Can clone curated or own custom exercises
 */
export const cloneExercise = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to clone exercises' },
    SOURCE_NOT_FOUND: { message: 'Source exercise not found' },
    VALIDATION_ERROR: { message: 'Invalid exercise data' },
  })
  .input(cloneExerciseInputSchema)
  .output(exerciseSchema)
  .handler(async ({ input, context, errors }) => {
    const cloneExerciseUseCase = makeCloneExercise({
      exerciseRepository: createExerciseRepository(context.db),
      generateId: () => crypto.randomUUID(),
    })

    const result = await cloneExerciseUseCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      sourceExerciseId: input.sourceExerciseId,
      name: input.name,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'source_not_found':
          throw errors.SOURCE_NOT_FOUND({ message: `Source exercise not found: ${result.error.exerciseId}` })
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'cloneExercise' })
          throw new Error('Internal error')
      }
    }

    const exercise = result.value

    return mapExerciseToOutput(exercise)
  })
