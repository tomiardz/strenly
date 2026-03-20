import { saveDraftInputSchema, saveDraftOutputSchema } from '@strenly/contracts/programs/save-draft'
import { createProgramRepository } from '../../infrastructure/repositories/program.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeSaveDraft } from '../../use-cases/programs/save-draft'

/**
 * Save draft changes to a program using the aggregate pattern.
 *
 * Accepts the complete program state from the frontend and persists it atomically.
 * Validation happens via the createProgram() domain factory in the use case.
 */
export const saveDraftProcedure = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to modify programs' },
    PROGRAM_NOT_FOUND: { message: 'Program not found' },
    VALIDATION_ERROR: { message: 'Validation error' },
    CONFLICT: { message: 'Program was modified by another user' },
  })
  .input(saveDraftInputSchema)
  .output(saveDraftOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const useCase = makeSaveDraft({
      programRepository: createProgramRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      programId: input.programId,
      program: input.program,
      lastLoadedAt: input.lastLoadedAt,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'program_not_found':
          throw errors.PROGRAM_NOT_FOUND()
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: result.error.message })
        case 'conflict':
          throw errors.CONFLICT({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'saveDraft' })
          throw new Error('Internal error')
      }
    }

    return {
      success: true,
      updatedAt: result.value.updatedAt,
      conflictWarning: result.value.conflictWarning,
    }
  })
