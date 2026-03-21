import { calculateStatus } from '@strenly/core/domain/entities/workout-log/calculate-status'
import type { LoggedExerciseInput } from '@strenly/core/domain/entities/workout-log/types'
import { createWorkoutLog, type WorkoutLog } from '@strenly/core/domain/entities/workout-log/workout-log'
import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type SaveLogInput = OrganizationContext & {
  id: string
  athleteId: string
  programId: string
  sessionId: string
  weekId: string
  logDate: Date
  sessionRpe?: number | null
  sessionNotes?: string | null
  exercises: LoggedExerciseInput[]
}

export type SaveLogError =
  | { type: 'forbidden'; message: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  workoutLogRepository: WorkoutLogRepositoryPort
}

/**
 * Save a workout log to the database.
 *
 * This use case:
 * 1. Checks authorization
 * 2. Validates via domain factory (createWorkoutLog)
 * 3. Calculates status automatically from exercise states
 * 4. Persists via repository.save()
 * 5. Returns saved log
 */
export const makeSaveLog =
  (deps: Dependencies) =>
  (input: SaveLogInput): ResultAsync<WorkoutLog, SaveLogError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'workout_log:update')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to save workout logs',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Calculate status automatically
    const status = calculateStatus(input.exercises)

    // 3. Validate via domain factory
    const logResult = createWorkoutLog({
      id: input.id,
      organizationId: input.organizationId,
      athleteId: input.athleteId,
      programId: input.programId,
      sessionId: input.sessionId,
      weekId: input.weekId,
      logDate: input.logDate,
      status,
      sessionRpe: input.sessionRpe ?? null,
      sessionNotes: input.sessionNotes ?? null,
      exercises: input.exercises,
    })

    if (logResult.isErr()) {
      return errAsync({
        type: 'validation_error',
        message: logResult.error.message,
      })
    }

    const log = logResult.value

    // 4. Persist via repository
    return deps.workoutLogRepository
      .save(ctx, log)
      .mapErr(
        (e): SaveLogError => ({
          type: 'repository_error',
          message: e.message,
        }),
      )
      .map(() => log)
  }
