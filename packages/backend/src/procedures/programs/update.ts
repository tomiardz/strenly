import { programSchema, updateProgramInputSchema } from '@strenly/contracts/programs/program'
import { createProgramRepository } from '../../infrastructure/repositories/program.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeUpdateProgram } from '../../use-cases/programs/update-program'
import { mapProgramToOutput } from './map-program-to-output'

/**
 * Update a program
 * Requires authentication and programs:write permission
 */
export const updateProgram = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to update programs' },
    NOT_FOUND: { message: 'Program not found' },
    VALIDATION_ERROR: { message: 'Invalid program data' },
  })
  .input(updateProgramInputSchema)
  .output(programSchema)
  .handler(async ({ input, context, errors }) => {
    const updateProgramUseCase = makeUpdateProgram({
      programRepository: createProgramRepository(context.db),
    })

    const result = await updateProgramUseCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      programId: input.programId,
      name: input.name,
      description: input.description,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'not_found':
          throw errors.NOT_FOUND({ message: `Program ${result.error.programId} not found` })
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'update' })
          throw new Error('Internal error')
      }
    }

    return mapProgramToOutput(result.value)
  })
