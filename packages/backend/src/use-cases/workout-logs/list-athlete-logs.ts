import type { WorkoutLog } from '@strenly/core/domain/entities/workout-log/types'
import type { WorkoutLogFilters, WorkoutLogRepositoryPort } from '@strenly/core/ports/workout-log-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type ListAthleteLogsInput = OrganizationContext & {
  athleteId: string
  status?: 'completed' | 'partial' | 'skipped'
  fromDate?: Date
  toDate?: Date
  limit?: number
  offset?: number
}

export type ListAthleteLogsResult = {
  items: WorkoutLog[]
  totalCount: number
}

export type ListAthleteLogsError =
  | { type: 'forbidden'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  workoutLogRepository: WorkoutLogRepositoryPort
}

export const makeListAthleteLogs =
  (deps: Dependencies) =>
  (input: ListAthleteLogsInput): ResultAsync<ListAthleteLogsResult, ListAthleteLogsError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'workout_log:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to read workout logs',
      })
    }

    // 2. Build filters
    const filters: Omit<WorkoutLogFilters, 'athleteId'> = {
      status: input.status,
      fromDate: input.fromDate,
      toDate: input.toDate,
      limit: input.limit ?? 20,
      offset: input.offset ?? 0,
    }

    // 3. Query repository
    return deps.workoutLogRepository
      .listByAthlete(
        { organizationId: input.organizationId, userId: input.userId, roles: input.roles },
        input.athleteId,
        filters,
      )
      .mapErr(
        (e): ListAthleteLogsError => ({
          type: 'repository_error',
          message: e.message,
        }),
      )
  }
