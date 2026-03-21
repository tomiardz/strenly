import type { MuscleGroupData, MuscleGroupRepositoryPort } from '@strenly/core/ports/muscle-group-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type ListMuscleGroupsInput = OrganizationContext

export type ListMuscleGroupsError =
  | { type: 'forbidden'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  muscleGroupRepository: MuscleGroupRepositoryPort
}

export const makeListMuscleGroups =
  (deps: Dependencies) =>
  (input: ListMuscleGroupsInput): ResultAsync<MuscleGroupData[], ListMuscleGroupsError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'exercises:read')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to list muscle groups',
      })
    }

    // 2. Query repository
    return deps.muscleGroupRepository.findAll().mapErr(
      (e): ListMuscleGroupsError => ({
        type: 'repository_error',
        message: e.type === 'DATABASE_ERROR' ? e.message : 'Failed to list muscle groups',
      }),
    )
  }
