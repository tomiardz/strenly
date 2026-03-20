import { ensureGroupAdjacency } from '@strenly/core/domain/entities/program/ensure-group-adjacency'
import type { ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type ReorderExerciseRowsInput = OrganizationContext & {
  sessionId: string
  rowIds: string[]
}

export type ReorderExerciseRowsError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; entityType: 'session'; id: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
}

export const makeReorderExerciseRows =
  (deps: Dependencies) =>
  (input: ReorderExerciseRowsInput): ResultAsync<void, ReorderExerciseRowsError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to modify programs',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }

    // 2. Fetch row metadata to check groups
    return deps.programRepository
      .findExerciseRowsBySessionId(ctx, input.sessionId)
      .mapErr((e): ReorderExerciseRowsError => {
        if (e.type === 'NOT_FOUND') {
          if (e.entityType === 'session') {
            return { type: 'not_found', entityType: 'session', id: e.id }
          }
          return { type: 'repository_error', message: `Entity not found: ${e.id}` }
        }
        return { type: 'repository_error', message: e.message }
      })
      .andThen((rows) => {
        // Build metadata map
        const rowMetadata = new Map<string, { groupId: string | null }>()
        for (const row of rows) {
          rowMetadata.set(row.id, { groupId: row.groupId })
        }

        // Ensure group adjacency
        const validatedOrder = ensureGroupAdjacency(input.rowIds, rowMetadata)

        // 3. Delegate to repository
        return deps.programRepository
          .reorderExerciseRows(ctx, input.sessionId, validatedOrder)
          .mapErr((e): ReorderExerciseRowsError => {
            if (e.type === 'NOT_FOUND' && e.entityType === 'session') {
              return { type: 'not_found', entityType: 'session', id: e.id }
            }
            if (e.type === 'NOT_FOUND') {
              return { type: 'repository_error', message: `Entity not found: ${e.id}` }
            }
            return { type: 'repository_error', message: e.message }
          })
      })
  }
