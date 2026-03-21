import { updatePrescriptionInputSchema, updatePrescriptionOutputSchema } from '@strenly/contracts/programs/prescription'
import { createProgramRepository } from '../../infrastructure/repositories/program.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeUpdatePrescription } from '../../use-cases/programs/update-prescription'

/**
 * Update a prescription cell in the program grid
 * This is the core operation for grid editing - called on every cell edit
 *
 * Parses notation like "3x8@120kg" into structured data
 * Pass "-" or empty string to clear the cell
 *
 * @deprecated Use aggregate save via programs.prescriptions.saveDraft instead
 */
export const updatePrescriptionProcedure = authProcedure
  .errors({
    FORBIDDEN: { message: 'You do not have permission to modify programs' },
    EXERCISE_ROW_NOT_FOUND: { message: 'Exercise row not found' },
    WEEK_NOT_FOUND: { message: 'Week not found' },
    VALIDATION_ERROR: { message: 'Invalid prescription notation' },
  })
  .input(updatePrescriptionInputSchema)
  .output(updatePrescriptionOutputSchema.nullable())
  .handler(async ({ input, context, errors }) => {
    const useCase = makeUpdatePrescription({
      programRepository: createProgramRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      exerciseRowId: input.exerciseRowId,
      weekId: input.weekId,
      notation: input.notation,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'not_found':
          if (result.error.entityType === 'exercise_row') {
            throw errors.EXERCISE_ROW_NOT_FOUND()
          }
          throw errors.WEEK_NOT_FOUND()
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'prescriptions' })
          throw new Error('Internal error')
      }
    }

    // Use case returns formatted notation or null (cleared)
    const notation = result.value
    return notation !== null ? { notation } : null
  })
