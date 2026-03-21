import { getProgramInputSchema, programAggregateSchema } from '@strenly/contracts/programs/program'
import { createProgramRepository } from '../../infrastructure/repositories/program.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeGetProgram } from '../../use-cases/programs/get-program'
import { mapProgramToAggregate } from './map-program-to-aggregate'

/**
 * Get a program with full aggregate hierarchy.
 *
 * Returns the complete program aggregate with:
 * weeks -> sessions -> exerciseGroups -> items -> series
 *
 * Requires authentication and programs:read permission.
 */
export const getProgram = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to view programs' },
    NOT_FOUND: { message: 'Program not found' },
  })
  .input(getProgramInputSchema)
  .output(programAggregateSchema)
  .handler(async ({ input, context, errors }) => {
    const getProgramUseCase = makeGetProgram({
      programRepository: createProgramRepository(context.db),
    })

    const result = await getProgramUseCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      programId: input.programId,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'not_found':
          throw errors.NOT_FOUND({ message: `Program ${result.error.programId} not found` })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'get' })
          throw new Error('Internal error')
      }
    }

    const program = result.value

    // Map domain Program to contract ProgramAggregate
    return mapProgramToAggregate(program)
  })
