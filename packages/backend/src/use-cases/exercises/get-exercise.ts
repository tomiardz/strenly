import type { Exercise } from '@strenly/core/domain/entities/exercise'
import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, okAsync, type ResultAsync } from 'neverthrow'

export type GetExerciseInput = OrganizationContext & {
  exerciseId: string
}

export type GetExerciseError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; exerciseId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  exerciseRepository: ExerciseRepositoryPort
}

export const makeGetExercise =
  (deps: Dependencies) =>
  (input: GetExerciseInput): ResultAsync<Exercise, GetExerciseError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'exercises:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to view exercises',
      })
    }

    // 2. Fetch exercise with organization scope (repository handles access control)
    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }
    return deps.exerciseRepository
      .findById(ctx, input.exerciseId)
      .mapErr(
        (e): GetExerciseError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Database error',
        }),
      )
      .andThen((exercise) => {
        // 3. Check if found (null means not found or no access)
        if (exercise === null) {
          return errAsync<Exercise, GetExerciseError>({
            type: 'not_found',
            exerciseId: input.exerciseId,
          })
        }

        return okAsync<Exercise, GetExerciseError>(exercise)
      })
  }
