import { athleteSchema, getAthleteInputSchema } from '@strenly/contracts/athletes/athlete'
import { createAthleteRepository } from '../../infrastructure/repositories/athlete.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeGetAthlete } from '../../use-cases/athletes/get-athlete'
import { mapAthleteToOutput } from './map-athlete-to-output'

/**
 * Get athlete procedure
 * Requires authentication and organization context
 */
export const getAthlete = authProcedure
  .input(getAthleteInputSchema)
  .output(athleteSchema)
  .errors({
    FORBIDDEN: { message: 'You do not have permission to view athletes' },
    NOT_FOUND: { message: 'Athlete not found' },
  })
  .handler(async ({ input, context, errors }) => {
    const useCase = makeGetAthlete({
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
          logger.error('Repository error', { error: result.error.message, procedure: 'getAthlete' })
          throw new Error('Internal error')
      }
    }

    const athlete = result.value

    return mapAthleteToOutput(athlete)
  })
