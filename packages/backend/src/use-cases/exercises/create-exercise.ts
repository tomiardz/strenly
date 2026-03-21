import type { Exercise } from '@strenly/core/domain/entities/exercise'
import { createExercise } from '@strenly/core/domain/entities/exercise'
import type { MovementPattern } from '@strenly/core/domain/value-objects/movement-pattern'
import type { MuscleGroup } from '@strenly/core/domain/value-objects/muscle-group'
import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type CreateExerciseInput = OrganizationContext & {
  name: string
  description?: string | null
  instructions?: string | null
  videoUrl?: string | null
  movementPattern?: MovementPattern | null
  isUnilateral?: boolean
  primaryMuscles?: MuscleGroup[]
  secondaryMuscles?: MuscleGroup[]
}

export type CreateExerciseError =
  | { type: 'forbidden'; message: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  exerciseRepository: ExerciseRepositoryPort
  generateId: () => string
}

export const makeCreateExercise =
  (deps: Dependencies) =>
  (input: CreateExerciseInput): ResultAsync<Exercise, CreateExerciseError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'exercises:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to create exercises',
      })
    }

    // 2. Domain validation - custom exercises MUST have organizationId
    const exerciseResult = createExercise({
      id: deps.generateId(),
      organizationId: input.organizationId,
      name: input.name,
      description: input.description,
      instructions: input.instructions,
      videoUrl: input.videoUrl,
      movementPattern: input.movementPattern,
      isUnilateral: input.isUnilateral,
      primaryMuscles: input.primaryMuscles,
      secondaryMuscles: input.secondaryMuscles,
    })

    if (exerciseResult.isErr()) {
      return errAsync({
        type: 'validation_error',
        message: exerciseResult.error.message,
      })
    }

    // 3. Persist with organization scope
    const ctx: OrganizationContext = {
      organizationId: input.organizationId,
      userId: input.userId,
      roles: input.roles,
    }

    return deps.exerciseRepository.create(ctx, exerciseResult.value).mapErr(
      (e): CreateExerciseError => ({
        type: 'repository_error',
        message: e.type === 'DATABASE_ERROR' ? e.message : `Exercise not found: ${e.exerciseId}`,
      }),
    )
  }
