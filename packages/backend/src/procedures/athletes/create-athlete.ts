import { athleteSchema, createAthleteInputSchema } from '@strenly/contracts/athletes/athlete'
import { createAthleteRepository } from '../../infrastructure/repositories/athlete.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeCreateAthlete } from '../../use-cases/athletes/create-athlete'
import { mapAthleteToOutput } from './map-athlete-to-output'

/**
 * Create athlete procedure
 * Requires authentication and organization context
 */
export const createAthlete = authProcedure
  .input(createAthleteInputSchema)
  .output(athleteSchema)
  .errors({
    FORBIDDEN: { message: 'You do not have permission to create athletes' },
    VALIDATION_ERROR: { message: 'Invalid athlete data' },
  })
  .handler(async ({ input, context, errors }) => {
    const useCase = makeCreateAthlete({
      athleteRepository: createAthleteRepository(context.db),
      generateId: () => crypto.randomUUID(),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      birthdate: input.birthdate ? new Date(input.birthdate) : null,
      gender: input.gender || null,
      notes: input.notes || null,
    })

    if (result.isErr()) {
      // Exhaustive error mapping
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'validation_error':
          throw errors.VALIDATION_ERROR()
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'createAthlete' })
          throw new Error('Internal error')
      }
    }

    const athlete = result.value

    return mapAthleteToOutput(athlete)
  })
