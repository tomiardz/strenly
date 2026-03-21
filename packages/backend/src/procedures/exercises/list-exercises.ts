import { listExercisesOutputSchema, listExercisesQuerySchema } from '@strenly/contracts/exercises/exercise'
import { createExerciseRepository } from '../../infrastructure/repositories/exercise.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeListExercises } from '../../use-cases/exercises/list-exercises'
import { mapExerciseToOutput } from './map-exercise-to-output'

/**
 * List exercises (curated + organization custom)
 * Requires authentication and exercises:read permission
 */
export const listExercises = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to list exercises' },
  })
  .input(listExercisesQuerySchema)
  .output(listExercisesOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const listExercisesUseCase = makeListExercises({
      exerciseRepository: createExerciseRepository(context.db),
    })

    const result = await listExercisesUseCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      movementPattern: input.movementPattern,
      muscleGroup: input.muscleGroup,
      search: input.search,
      includeArchived: input.includeArchived,
      limit: input.limit,
      offset: input.offset,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'listExercises' })
          throw new Error('Internal error')
      }
    }

    const { items, totalCount } = result.value

    return {
      items: items.map(mapExerciseToOutput),
      totalCount,
    }
  })
