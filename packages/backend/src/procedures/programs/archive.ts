import { archiveProgramInputSchema, programSchema } from '@strenly/contracts/programs/program'
import { createProgramRepository } from '../../infrastructure/repositories/program.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeArchiveProgram } from '../../use-cases/programs/archive-program'
import { mapProgramToOutput } from './map-program-to-output'

/**
 * Archive a program (soft delete via status transition)
 * Requires authentication and programs:delete permission
 */
export const archiveProgram = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to archive programs' },
    NOT_FOUND: { message: 'Program not found' },
    INVALID_TRANSITION: { message: 'Cannot archive program' },
  })
  .input(archiveProgramInputSchema)
  .output(programSchema)
  .handler(async ({ input, context, errors }) => {
    const archiveProgramUseCase = makeArchiveProgram({
      programRepository: createProgramRepository(context.db),
    })

    const result = await archiveProgramUseCase({
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
        case 'invalid_transition':
          throw errors.INVALID_TRANSITION({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'archive' })
          throw new Error('Internal error')
      }
    }

    return mapProgramToOutput(result.value)
  })
