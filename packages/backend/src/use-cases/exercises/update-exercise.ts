import type { Exercise } from '@strenly/core/domain/entities/exercise'
import { createExercise, isCurated } from '@strenly/core/domain/entities/exercise'
import type { MovementPattern } from '@strenly/core/domain/value-objects/movement-pattern'
import type { MuscleGroup } from '@strenly/core/domain/value-objects/muscle-group'
import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type UpdateExerciseInput = OrganizationContext & {
  exerciseId: string
  name?: string
  description?: string | null
  instructions?: string | null
  videoUrl?: string | null
  movementPattern?: MovementPattern | null
  isUnilateral?: boolean
  primaryMuscles?: MuscleGroup[]
  secondaryMuscles?: MuscleGroup[]
}

export type UpdateExerciseError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; exerciseId: string }
  | { type: 'cannot_edit_curated'; message: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  exerciseRepository: ExerciseRepositoryPort
}

export const makeUpdateExercise =
  (deps: Dependencies) =>
  (input: UpdateExerciseInput): ResultAsync<Exercise, UpdateExerciseError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'exercises:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to update exercises',
      })
    }

    // 2. Fetch existing exercise (repository handles org scope)
    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }
    return deps.exerciseRepository
      .findById(ctx, input.exerciseId)
      .mapErr(
        (e): UpdateExerciseError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Database error',
        }),
      )
      .andThen((existing) => {
        // 3. Check if found
        if (existing === null) {
          return errAsync<Exercise, UpdateExerciseError>({
            type: 'not_found',
            exerciseId: input.exerciseId,
          })
        }

        // 4. Cannot edit curated exercises
        if (isCurated(existing)) {
          return errAsync<Exercise, UpdateExerciseError>({
            type: 'cannot_edit_curated',
            message: 'Cannot edit curated exercises. Clone it to create a custom version.',
          })
        }

        // 5. Merge updates with existing
        const updatedResult = createExercise({
          id: existing.id,
          organizationId: existing.organizationId,
          name: input.name ?? existing.name,
          description: input.description !== undefined ? input.description : existing.description,
          instructions: input.instructions !== undefined ? input.instructions : existing.instructions,
          videoUrl: input.videoUrl !== undefined ? input.videoUrl : existing.videoUrl,
          movementPattern: input.movementPattern !== undefined ? input.movementPattern : existing.movementPattern,
          isUnilateral: input.isUnilateral !== undefined ? input.isUnilateral : existing.isUnilateral,
          clonedFromId: existing.clonedFromId,
          primaryMuscles: input.primaryMuscles ?? [...existing.primaryMuscles],
          secondaryMuscles: input.secondaryMuscles ?? [...existing.secondaryMuscles],
          archivedAt: existing.archivedAt,
        })

        if (updatedResult.isErr()) {
          return errAsync<Exercise, UpdateExerciseError>({
            type: 'validation_error',
            message: updatedResult.error.message,
          })
        }

        // 6. Persist update with organization scope
        return deps.exerciseRepository.update(ctx, updatedResult.value).mapErr(
          (e): UpdateExerciseError => ({
            type: 'repository_error',
            message: e.type === 'DATABASE_ERROR' ? e.message : `Exercise not found: ${e.exerciseId}`,
          }),
        )
      })
  }
