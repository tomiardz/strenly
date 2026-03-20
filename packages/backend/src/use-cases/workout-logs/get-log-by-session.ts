import type { WorkoutLog } from '@strenly/core/domain/entities/workout-log/workout-log'
import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type GetLogBySessionInput = OrganizationContext & {
  athleteId: string
  sessionId: string
  weekId: string
}

export type GetLogBySessionError =
  | { type: 'forbidden'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  workoutLogRepository: WorkoutLogRepositoryPort
}

/**
 * Get a workout log by athlete, session, and week combination.
 *
 * This use case:
 * 1. Checks authorization
 * 2. Queries repository.findByAthleteSessionWeek()
 * 3. Returns log if found, null if not found
 *
 * Used by frontend to check if a log already exists before creating a new one.
 */
export const makeGetLogBySession =
  (deps: Dependencies) =>
  (input: GetLogBySessionInput): ResultAsync<WorkoutLog | null, GetLogBySessionError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'workout_log:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to view workout logs',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Query by athlete/session/week - returns null if not found
    return deps.workoutLogRepository
      .findByAthleteSessionWeek(ctx, input.athleteId, input.sessionId, input.weekId)
      .mapErr(
        (e): GetLogBySessionError => ({
          type: 'repository_error',
          message: e.message,
        }),
      )
  }
