import type { Exercise } from '@strenly/core/domain/entities/exercise'
import type { MovementPattern } from '@strenly/core/domain/value-objects/movement-pattern'
import type { MuscleGroup } from '@strenly/core/domain/value-objects/muscle-group'
import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type ListExercisesInput = OrganizationContext & {
  movementPattern?: MovementPattern
  muscleGroup?: MuscleGroup
  search?: string
  includeArchived?: boolean
  limit?: number
  offset?: number
}

export type ListExercisesResult = {
  items: Exercise[]
  totalCount: number
}

export type ListExercisesError = { type: 'forbidden'; message: string } | { type: 'repository_error'; message: string }

type Dependencies = {
  exerciseRepository: ExerciseRepositoryPort
}

export const makeListExercises =
  (deps: Dependencies) =>
  (input: ListExercisesInput): ResultAsync<ListExercisesResult, ListExercisesError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'exercises:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to list exercises',
      })
    }

    // 2. Query repository - includes curated (null orgId) + org's custom exercises
    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }
    return deps.exerciseRepository
      .findAll(ctx, {
        movementPattern: input.movementPattern,
        muscleGroup: input.muscleGroup,
        search: input.search,
        includeArchived: input.includeArchived,
        limit: input.limit ?? 10,
        offset: input.offset ?? 0,
      })
      .mapErr(
        (e): ListExercisesError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : 'Failed to list exercises',
        }),
      )
  }
