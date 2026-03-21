import type { Exercise } from '@strenly/core/domain/entities/exercise'
import { createExercise } from '@strenly/core/domain/entities/exercise'
import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type CloneExerciseInput = OrganizationContext & {
  sourceExerciseId: string
  name?: string
}

export type CloneExerciseError =
  | { type: 'forbidden'; message: string }
  | { type: 'source_not_found'; exerciseId: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  exerciseRepository: ExerciseRepositoryPort
  generateId: () => string
}

export const makeCloneExercise =
  (deps: Dependencies) =>
  (input: CloneExerciseInput): ResultAsync<Exercise, CloneExerciseError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'exercises:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to clone exercises',
      })
    }

    // 2. Fetch source exercise with organization scope (repository handles access control)
    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }
    return deps.exerciseRepository
      .findById(ctx, input.sourceExerciseId)
      .mapErr(
        (e): CloneExerciseError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Database error',
        }),
      )
      .andThen((source) => {
        // 3. Check if found (null means not found or no access)
        if (source === null) {
          return errAsync<Exercise, CloneExerciseError>({
            type: 'source_not_found',
            exerciseId: input.sourceExerciseId,
          })
        }

        // 4. Create cloned exercise
        const clonedName = input.name ?? `${source.name} (Custom)`
        const clonedResult = createExercise({
          id: deps.generateId(),
          organizationId: input.organizationId,
          name: clonedName,
          description: source.description,
          instructions: source.instructions,
          videoUrl: source.videoUrl,
          movementPattern: source.movementPattern,
          isUnilateral: source.isUnilateral,
          clonedFromId: source.id,
          primaryMuscles: [...source.primaryMuscles],
          secondaryMuscles: [...source.secondaryMuscles],
        })

        if (clonedResult.isErr()) {
          return errAsync<Exercise, CloneExerciseError>({
            type: 'validation_error',
            message: clonedResult.error.message,
          })
        }

        // 5. Persist cloned exercise with organization scope
        return deps.exerciseRepository.create(ctx, clonedResult.value).mapErr(
          (e): CloneExerciseError => ({
            type: 'repository_error',
            message: e.type === 'DATABASE_ERROR' ? e.message : `Exercise not found: ${e.exerciseId}`,
          }),
        )
      })
  }
