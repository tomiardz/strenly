import { saveLogInputSchema, saveLogOutputSchema } from '@strenly/contracts/workout-logs/save-log'
import { createWorkoutLogRepository } from '../../infrastructure/repositories/workout-log.repository'
import { logger } from '../../lib/logger'
import { authProcedure } from '../../lib/orpc'
import { makeSaveLog } from '../../use-cases/workout-logs/save-log'
import { mapLogToOutput } from './map-log-to-output'

/**
 * Save a workout log to the database.
 * Calculates status automatically from exercise states.
 */
export const saveLog = authProcedure
  .errors({
    FORBIDDEN: { message: 'No permission to save workout logs' },
    VALIDATION_ERROR: { message: 'Invalid log data' },
    INTERNAL_ERROR: { message: 'Internal server error' },
  })
  .input(saveLogInputSchema)
  .output(saveLogOutputSchema)
  .handler(async ({ input, context, errors }) => {
    const useCase = makeSaveLog({
      workoutLogRepository: createWorkoutLogRepository(context.db),
    })

    const result = await useCase({
      organizationId: context.organization.id,
      userId: context.user.id,
      roles: context.membership.roles,
      id: input.id,
      athleteId: input.athleteId,
      programId: input.programId,
      sessionId: input.sessionId,
      weekId: input.weekId,
      logDate: new Date(input.logDate),
      sessionRpe: input.sessionRpe,
      sessionNotes: input.sessionNotes,
      exercises: input.exercises.map((ex) => ({
        id: ex.id,
        exerciseId: ex.exerciseId,
        groupItemId: ex.groupItemId,
        orderIndex: ex.orderIndex,
        notes: ex.notes ?? null,
        skipped: ex.skipped ?? false,
        series: ex.series?.map((s) => ({
          repsPerformed: s.repsPerformed ?? null,
          weightUsed: s.weightUsed ?? null,
          rpe: s.rpe ?? null,
          skipped: s.skipped ?? false,
          prescribedReps: s.prescribedReps ?? null,
          prescribedWeight: s.prescribedWeight ?? null,
        })),
      })),
    })

    if (result.isErr()) {
      switch (result.error.type) {
        case 'forbidden':
          throw errors.FORBIDDEN({ message: result.error.message })
        case 'validation_error':
          throw errors.VALIDATION_ERROR({ message: result.error.message })
        case 'repository_error':
          logger.error('Repository error', { error: result.error.message, procedure: 'saveLog' })
          throw errors.INTERNAL_ERROR({ message: 'Database save error' })
      }
    }

    return mapLogToOutput(result.value)
  })
