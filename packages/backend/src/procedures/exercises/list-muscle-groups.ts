import { listMuscleGroupsOutputSchema } from '@strenly/contracts/exercises/muscle-group'
import { createMuscleGroupRepository } from '../../infrastructure/repositories/muscle-group.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeListMuscleGroups } from '../../use-cases/exercises/list-muscle-groups'

/**
 * List all muscle groups
 * Requires authentication and exercises:read permission
 * Returns all muscle groups with display names and body regions
 */
export const listMuscleGroups = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to list muscle groups' },
    INTERNAL_ERROR: { message: 'Failed to load muscle groups' },
  })
  .output(listMuscleGroupsOutputSchema)
  .handler(async ({ context, errors }) => {
    const listMuscleGroupsUseCase = makeListMuscleGroups({
      muscleGroupRepository: createMuscleGroupRepository(context.db),
    })

    const result = await listMuscleGroupsUseCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'listMuscleGroups' })
          throw errors.INTERNAL_ERROR({ message: result.error.message })
      }
    }

    // Repository validates names, return directly
    return result.value
  })
