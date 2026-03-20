import { archiveAthleteInputSchema, archiveAthleteOutputSchema } from '@strenly/contracts/athletes/athlete'
import { createAthleteRepository } from '../../infrastructure/repositories/athlete.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeArchiveAthlete } from '../../use-cases/athletes/archive-athlete'

/**
 * Archive athlete procedure
 * Soft delete - sets status to inactive
 * Requires authentication and organization context
 */
export const archiveAthlete = authProcedure
  .input(archiveAthleteInputSchema)
  .output(archiveAthleteOutputSchema)
  .errors({
    FORBIDDEN: { message: 'You do not have permission to archive athletes' },
    NOT_FOUND: { message: 'Athlete not found' },
  })
  .handler(async ({ input, context, errors }) => {
    const useCase = makeArchiveAthlete({
      athleteRepository: createAthleteRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      athleteId: input.athleteId,
    })

    if (result.isErr()) {
      // Exhaustive error mapping
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'not_found':
          throw errors.NOT_FOUND()
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'archiveAthlete' })
          throw new Error('Internal error')
      }
    }

    return { success: true }
  })
