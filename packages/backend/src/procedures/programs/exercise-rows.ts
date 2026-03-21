import { successOutputSchema } from '@strenly/contracts/common/success'
import {
  addExerciseRowInputSchema,
  deleteExerciseRowInputSchema,
  exerciseRowOutputSchema,
  reorderExerciseRowsInputSchema,
  updateExerciseRowInputSchema,
} from '@strenly/contracts/programs/exercise-row'
import { createExerciseRepository } from '../../infrastructure/repositories/exercise.repository'
import { createProgramRepository } from '../../infrastructure/repositories/program.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeAddExerciseRow } from '../../use-cases/programs/add-exercise-row'
import { makeDeleteExerciseRow } from '../../use-cases/programs/delete-exercise-row'
import { makeReorderExerciseRows } from '../../use-cases/programs/reorder-exercise-rows'
import { makeUpdateExerciseRow } from '../../use-cases/programs/update-exercise-row'

/**
 * Add an exercise row to a session
 */
export const addExerciseRowProcedure = authProcedure
  .errors({
    FORBIDDEN: { message: 'You do not have permission to modify programs' },
    SESSION_NOT_FOUND: { message: 'Session not found' },
    VALIDATION_ERROR: { message: 'Invalid exercise row data' },
  })
  .input(addExerciseRowInputSchema)
  .output(exerciseRowOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const programRepository = createProgramRepository(context.db)
    const exerciseRepository = createExerciseRepository(context.db)

    const useCase = makeAddExerciseRow({
      programRepository,
      exerciseRepository,
      generateId: () => crypto.randomUUID(),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      sessionId: input.sessionId,
      exerciseId: input.exerciseId,
      groupId: input.groupId ?? null,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'not_found':
          throw errors.SESSION_NOT_FOUND()
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'exerciseRows' })
          throw new Error('Internal error')
      }
    }

    const { row, exerciseName } = result.value

    return {
      id: row.id,
      sessionId: row.sessionId,
      exerciseId: row.exerciseId,
      exerciseName,
      orderIndex: row.orderIndex,
      groupId: row.groupId,
      orderWithinGroup: row.orderWithinGroup,
      setTypeLabel: row.setTypeLabel,
      notes: row.notes,
      restSeconds: row.restSeconds,
    }
  })

/**
 * Update an exercise row's properties
 */
export const updateExerciseRowProcedure = authProcedure
  .errors({
    FORBIDDEN: { message: 'You do not have permission to modify programs' },
    NOT_FOUND: { message: 'Exercise row not found' },
    VALIDATION_ERROR: { message: 'Invalid exercise row data' },
  })
  .input(updateExerciseRowInputSchema)
  .output(exerciseRowOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const programRepository = createProgramRepository(context.db)
    const exerciseRepository = createExerciseRepository(context.db)

    const useCase = makeUpdateExerciseRow({
      programRepository,
      exerciseRepository,
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      rowId: input.rowId,
      exerciseId: input.exerciseId,
      groupId: input.groupId,
      orderWithinGroup: input.orderWithinGroup,
      setTypeLabel: input.setTypeLabel,
      notes: input.notes,
      restSeconds: input.restSeconds,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'not_found':
          throw errors.NOT_FOUND()
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'exerciseRows' })
          throw new Error('Internal error')
      }
    }

    const { row, exerciseName } = result.value

    return {
      id: row.id,
      sessionId: row.sessionId,
      exerciseId: row.exerciseId,
      exerciseName,
      orderIndex: row.orderIndex,
      groupId: row.groupId,
      orderWithinGroup: row.orderWithinGroup,
      setTypeLabel: row.setTypeLabel,
      notes: row.notes,
      restSeconds: row.restSeconds,
    }
  })

/**
 * Delete an exercise row
 */
export const deleteExerciseRowProcedure = authProcedure
  .errors({
    FORBIDDEN: { message: 'You do not have permission to modify programs' },
    NOT_FOUND: { message: 'Exercise row not found' },
  })
  .input(deleteExerciseRowInputSchema)
  .output(successOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const useCase = makeDeleteExerciseRow({
      programRepository: createProgramRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      rowId: input.rowId,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'not_found':
          throw errors.NOT_FOUND()
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'exerciseRows' })
          throw new Error('Internal error')
      }
    }

    return { success: true }
  })

/**
 * Reorder exercise rows in a session (for drag-and-drop)
 */
export const reorderExerciseRowsProcedure = authProcedure
  .errors({
    FORBIDDEN: { message: 'You do not have permission to modify programs' },
    SESSION_NOT_FOUND: { message: 'Session not found' },
  })
  .input(reorderExerciseRowsInputSchema)
  .output(successOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const useCase = makeReorderExerciseRows({
      programRepository: createProgramRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      sessionId: input.sessionId,
      rowIds: input.rowIds,
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN()
        case 'not_found':
          throw errors.SESSION_NOT_FOUND()
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'exerciseRows' })
          throw new Error('Internal error')
      }
    }

    return { success: true }
  })
