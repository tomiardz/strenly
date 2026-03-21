import type { PendingWorkout, WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type ListPendingWorkoutsInput = OrganizationContext & {
  limit?: number
  offset?: number
}

export type ListPendingWorkoutsResult = {
  items: PendingWorkout[]
  totalCount: number
}

export type ListPendingWorkoutsError =
  | { type: 'forbidden'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  workoutLogRepository: WorkoutLogRepositoryPort
}

/**
 * List pending workouts for the logging dashboard.
 * Returns sessions that have no log yet (need to be logged).
 */
export const makeListPendingWorkouts =
  (deps: Dependencies) =>
  (input: ListPendingWorkoutsInput): ResultAsync<ListPendingWorkoutsResult, ListPendingWorkoutsError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'workout_log:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to read workout logs',
      })
    }

    // 2. Query repository for pending workouts
    return deps.workoutLogRepository
      .listPendingWorkouts(
        { organizationId: input.organizationId, userId: input.userId, roles: input.roles },
        {
          limit: input.limit ?? 50,
          offset: input.offset ?? 0,
        },
      )
      .mapErr(
        (e): ListPendingWorkoutsError => ({
          type: 'repository_error',
          message: e.message,
        }),
      )
  }
