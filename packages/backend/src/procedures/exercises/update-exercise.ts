import { exerciseSchema, updateExerciseInputSchema } from '@strenly/contracts/exercises/exercise'
import { createExerciseRepository } from '../../infrastructure/repositories/exercise.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeUpdateExercise } from '../../use-cases/exercises/update-exercise'
import { mapExerciseToOutput } from './map-exercise-to-output'

/**
 * Update a custom exercise
 * Requires authentication and exercises:write permission
 * Cannot update curated exercises - clone them first
 */
export const updateExercise = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to update exercises' },
    NOT_FOUND: { message: 'Exercise not found' },
    CANNOT_EDIT_CURATED: { message: 'Cannot edit curated exercises' },
    VALIDATION_ERROR: { message: 'Invalid exercise data' },
  })
  .input(updateExerciseInputSchema)
  .output(exerciseSchema)
  .handler(async ({ input, context, errors }) => {
    const updateExerciseUseCase = makeUpdateExercise({
      exerciseRepository: createExerciseRepository(context.db),
    })

    const result = await updateExerciseUseCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      exerciseId: input.exerciseId,
      name: input.name,
      description: input.description,
      instructions: input.instructions,
      videoUrl: input.videoUrl,
      movementPattern: input.movementPattern,
      isUnilateral: input.isUnilateral,
      primaryMuscles: input.primaryMuscles,
      secondaryMuscles: input.secondaryMuscles,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'not_found':
          throw errors.NOT_FOUND({ message: `Exercise not found: ${result.error.exerciseId}` })
        case 'cannot_edit_curated':
          throw errors.CANNOT_EDIT_CURATED({ message: result.error.message })
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'updateExercise' })
          throw new Error('Internal error')
      }
    }

    const exercise = result.value

    return mapExerciseToOutput(exercise)
  })
