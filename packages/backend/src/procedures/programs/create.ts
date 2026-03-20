import { createProgramInputSchema, programSchema } from '@strenly/contracts/programs/program'
import { createAthleteRepository } from '../../infrastructure/repositories/athlete.repository'
import { createProgramRepository } from '../../infrastructure/repositories/program.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeCreateProgram } from '../../use-cases/programs/create-program'
import { mapProgramToOutput } from './map-program-to-output'

/**
 * Create a new program
 * Requires authentication and programs:write permission
 */
export const createProgram = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to create programs' },
    VALIDATION_ERROR: { message: 'Invalid program data' },
    ATHLETE_NOT_FOUND: { message: 'Athlete not found' },
  })
  .input(createProgramInputSchema)
  .output(programSchema)
  .handler(async ({ input, context, errors }) => {
    const createProgramUseCase = makeCreateProgram({
      programRepository: createProgramRepository(context.db),
      athleteRepository: createAthleteRepository(context.db),
      generateId: () => crypto.randomUUID(),
    })

    const result = await createProgramUseCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      name: input.name,
      description: input.description || null,
      athleteId: input.athleteId ?? null,
      isTemplate: input.isTemplate,
      weeksCount: input.weeksCount,
      sessionsCount: input.sessionsCount,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: result.error.message })
        case 'athlete_not_found':
          throw errors.ATHLETE_NOT_FOUND({ message: `Athlete ${result.error.athleteId} not found` })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'create' })
          throw new Error('Internal error')
      }
    }

    return mapProgramToOutput(result.value)
  })
