import { athleteSchema, updateAthleteInputSchema } from '@strenly/contracts/athletes/athlete'
import { createAthleteRepository } from '../../infrastructure/repositories/athlete.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeUpdateAthlete } from '../../use-cases/athletes/update-athlete'
import { mapAthleteToOutput } from './map-athlete-to-output'

/**
 * Update athlete procedure
 * Requires authentication and organization context
 */
export const updateAthlete = authProcedure
  .input(updateAthleteInputSchema)
  .output(athleteSchema)
  .errors({
    FORBIDDEN: { message: 'No permission to update athletes' },
    NOT_FOUND: { message: 'Athlete not found' },
    VALIDATION_ERROR: { message: 'Invalid athlete data' },
  })
  .handler(async ({ input, context, errors }) => {
    const useCase = makeUpdateAthlete({
      athleteRepository: createAthleteRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      athleteId: input.athleteId,
      name: input.name,
      email: input.email !== undefined ? input.email || null : undefined,
      phone: input.phone !== undefined ? input.phone || null : undefined,
      birthdate: input.birthdate !== undefined ? (input.birthdate ? new Date(input.birthdate) : null) : undefined,
      gender: input.gender !== undefined ? input.gender || null : undefined,
      notes: input.notes !== undefined ? input.notes || null : undefined,
      status: input.status,
    })

    if (result.isErr()) {
      // Exhaustive error mapping
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'not_found':
          throw errors.NOT_FOUND()
        case 'validation_error':
          throw errors.VALIDATION_ERROR()
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'updateAthlete' })
          throw new Error('Internal error')
      }
    }

    const athlete = result.value

    return mapAthleteToOutput(athlete)
  })
