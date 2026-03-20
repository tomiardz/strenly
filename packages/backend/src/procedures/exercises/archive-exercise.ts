import { archiveExerciseInputSchema, archiveExerciseOutputSchema } from '@strenly/contracts/exercises/exercise'
import { createExerciseRepository } from '../../infrastructure/repositories/exercise.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeArchiveExercise } from '../../use-cases/exercises/archive-exercise'

/**
 * Archive a custom exercise (soft delete)
 * Requires authentication and exercises:write permission
 * Cannot archive curated exercises
 */
export const archiveExercise = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to archive exercises' },
    NOT_FOUND: { message: 'Exercise not found' },
    CANNOT_ARCHIVE_CURATED: { message: 'Cannot archive curated exercises' },
  })
  .input(archiveExerciseInputSchema)
  .output(archiveExerciseOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const archiveExerciseUseCase = makeArchiveExercise({
      exerciseRepository: createExerciseRepository(context.db),
    })

    const result = await archiveExerciseUseCase({
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
        case 'cannot_archive_curated':
          throw errors.CANNOT_ARCHIVE_CURATED({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'archiveExercise' })
          throw new Error('Internal error')
      }
    }

    return { success: true }
  })
