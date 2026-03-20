import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type DeleteExerciseRowInput = OrganizationContext & {
  rowId: string
}

export type DeleteExerciseRowError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; rowId: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
}

export const makeDeleteExerciseRow =
  (deps: Dependencies) =>
  (input: DeleteExerciseRowInput): ResultAsync<void, DeleteExerciseRowError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to modify programs',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }

    // 2. Delete the row (prescriptions cascade via foreign key)
    return deps.programRepository.deleteExerciseRow(ctx, input.rowId).mapErr((e): DeleteExerciseRowError => {
      if (e.type === 'NOT_FOUND') {
        return { type: 'not_found', rowId: input.rowId }
      }
      return { type: 'repository_error', message: e.message }
    })
  }
