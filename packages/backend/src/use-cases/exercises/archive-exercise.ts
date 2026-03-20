import { isCurated } from '@strenly/core/domain/entities/exercise'
import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type ArchiveExerciseInput = OrganizationContext & {
  exerciseId: string
}

export type ArchiveExerciseError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; exerciseId: string }
  | { type: 'cannot_archive_curated'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  exerciseRepository: ExerciseRepositoryPort
}

export const makeArchiveExercise =
  (deps: Dependencies) =>
  (input: ArchiveExerciseInput): ResultAsync<void, ArchiveExerciseError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'exercises:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to archive exercises',
      })
    }

    // 2. Fetch exercise to verify ownership (repository handles org scope)
    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }
    return deps.exerciseRepository
      .findById(ctx, input.exerciseId)
      .mapErr(
        (e): ArchiveExerciseError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Database error',
        }),
      )
      .andThen((exercise) => {
        // 3. Check if found
        if (exercise === null) {
          return errAsync<void, ArchiveExerciseError>({
            type: 'not_found',
            exerciseId: input.exerciseId,
          })
        }

        // 4. Cannot archive curated exercises
        if (isCurated(exercise)) {
          return errAsync<void, ArchiveExerciseError>({
            type: 'cannot_archive_curated',
            message: 'Cannot archive curated exercises',
          })
        }

        // 5. Archive the exercise (soft delete via archivedAt timestamp) with organization scope
        return deps.exerciseRepository.archive(ctx, input.exerciseId).mapErr(
          (e): ArchiveExerciseError => ({
            type: 'repository_error',
            message: e.type === 'DATABASE_ERROR' ? e.message : `Exercise not found: ${e.exerciseId}`,
          }),
        )
      })
  }
