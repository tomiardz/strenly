import type { WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type DeleteLogInput = OrganizationContext & {
  logId: string
}

export type DeleteLogError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; logId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  workoutLogRepository: WorkoutLogRepositoryPort
}

/**
 * Delete a workout log.
 * Checks authorization and verifies log exists before deleting.
 */
export const makeDeleteLog =
  (deps: Dependencies) =>
  (input: DeleteLogInput): ResultAsync<void, DeleteLogError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'workout_log:delete')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to delete workout logs',
      })
    }

    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    // 2. Verify log exists before deleting
    return (
      deps.workoutLogRepository
        .findById(ctx, input.logId)
        .mapErr(
          (e): DeleteLogError => ({
            type: 'repository_error',
            message: e.message,
          }),
        )
        .andThen((log) => {
          if (!log) {
            return errAsync<void, DeleteLogError>({
              type: 'not_found',
              logId: input.logId,
            })
          }
          return okAsync(undefined)
        })
        // 3. Delete the log
        .andThen(() =>
          deps.workoutLogRepository.delete(ctx, input.logId).mapErr(
            (e): DeleteLogError => ({
              type: 'repository_error',
              message: e.message,
            }),
          ),
        )
    )
  }
