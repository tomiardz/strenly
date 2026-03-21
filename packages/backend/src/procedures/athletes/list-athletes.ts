import { listAthletesOutputSchema, listAthletesQuerySchema } from '@strenly/contracts/athletes/athlete'
import { createAthleteRepository } from '../../infrastructure/repositories/athlete.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeListAthletes } from '../../use-cases/athletes/list-athletes'
import { mapAthleteToOutput } from './map-athlete-to-output'

/**
 * List athletes procedure
 * Requires authentication and organization context
 * Supports filtering by status, search, and pagination
 */
export const listAthletes = authProcedure
  .input(listAthletesQuerySchema)
  .output(listAthletesOutputSchema)
  .errors({
    FORBIDDEN: { message: 'No permission to view athletes' },
  })
  .handler(async ({ input, context, errors }) => {
    const useCase = makeListAthletes({
      athleteRepository: createAthleteRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      status: input.status,
      search: input.search,
      limit: input.limit,
      offset: input.offset,
    })

    if (result.isErr()) {
      // Exhaustive error mapping
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'listAthletes' })
          throw new Error('Internal error')
      }
    }

    const { items, totalCount } = result.value

    return {
      items: items.map(mapAthleteToOutput),
      totalCount,
    }
  })
