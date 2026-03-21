import type { WorkoutLog } from '@strenly/core/domain/entities/workout-log/workout-log'
import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type GetLogInput = OrganizationContext & {
  logId: string
}

export type GetLogError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; logId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  workoutLogRepository: WorkoutLogRepositoryPort
}

/**
 * Get a workout log by ID.
 *
 * This use case:
 * 1. Checks authorization
 * 2. Loads from repository.findById()
 * 3. Returns log if found, error with 'not_found' if not
 */
export const makeGetLog =
  (deps: Dependencies) =>
  (input: GetLogInput): ResultAsync<WorkoutLog, GetLogError> => {
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

    // 2. Load from repository
    return deps.workoutLogRepository
      .findById(ctx, input.logId)
      .mapErr(
        (e): GetLogError => ({
          type: 'repository_error',
          message: e.message,
        }),
      )
      .andThen((log) => {
        if (log === null) {
          return errAsync<WorkoutLog, GetLogError>({
            type: 'not_found',
            logId: input.logId,
          })
        }
        return okAsync(log)
      })
  }
