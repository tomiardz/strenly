import { createGroupItem } from '@strenly/core/domain/entities/program/group-item'
import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import type { ProgramExerciseRow, ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type UpdateExerciseRowInput = OrganizationContext & {
  rowId: string
  exerciseId?: string
  groupId?: string | null
  orderWithinGroup?: number | null
  setTypeLabel?: string | null
  notes?: string | null
  restSeconds?: number | null
}

export type UpdateExerciseRowResult = {
  row: ProgramExerciseRow
  exerciseName: string
}

export type UpdateExerciseRowError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; rowId: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
  exerciseRepository: ExerciseRepositoryPort
}

export const makeUpdateExerciseRow =
  (deps: Dependencies) =>
  (input: UpdateExerciseRowInput): ResultAsync<UpdateExerciseRowResult, UpdateExerciseRowError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to modify programs',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }

    // 2. Fetch existing row
    return deps.programRepository
      .findExerciseRowById(ctx, input.rowId)
      .mapErr(
        (e): UpdateExerciseRowError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
      .andThen((existing) => {
        if (!existing) {
          return errAsync<UpdateExerciseRowResult, UpdateExerciseRowError>({ type: 'not_found', rowId: input.rowId })
        }
        // 3. Validate core fields via domain factory
        const exerciseId = input.exerciseId ?? existing.exerciseId
        const itemResult = createGroupItem({ id: existing.id, exerciseId, orderIndex: existing.orderIndex })

        if (itemResult.isErr()) {
          return errAsync<UpdateExerciseRowResult, UpdateExerciseRowError>({
            type: 'validation_error',
            message: itemResult.error.message,
          })
        }

        const updated: ProgramExerciseRow = {
          id: existing.id,
          sessionId: existing.sessionId,
          exerciseId: itemResult.value.exerciseId,
          orderIndex: existing.orderIndex,
          groupId: input.groupId !== undefined ? input.groupId : existing.groupId,
          orderWithinGroup: input.orderWithinGroup !== undefined ? input.orderWithinGroup : existing.orderWithinGroup,
          setTypeLabel: input.setTypeLabel !== undefined ? input.setTypeLabel : existing.setTypeLabel,
          notes: input.notes !== undefined ? input.notes : existing.notes,
          restSeconds: input.restSeconds !== undefined ? input.restSeconds : existing.restSeconds,
          createdAt: existing.createdAt,
          updatedAt: new Date(),
        }

        // 4. Persist
        return deps.programRepository
          .updateExerciseRow(ctx, updated)
          .mapErr((e): UpdateExerciseRowError => {
            if (e.type === 'NOT_FOUND') {
              return { type: 'not_found', rowId: e.id }
            }
            return { type: 'repository_error', message: e.message }
          })
          .andThen((updatedRow) => {
            // 5. Fetch exercise name for the response
            return deps.exerciseRepository
              .findById(ctx, updatedRow.exerciseId)
              .map(
                (exercise): UpdateExerciseRowResult => ({
                  row: updatedRow,
                  exerciseName: exercise?.name ?? 'Unknown',
                }),
              )
              .mapErr(
                (e): UpdateExerciseRowError => ({
                  type: 'repository_error',
                  message: e.type === 'DATABASE_ERROR' ? e.message : 'Failed to fetch exercise',
                }),
              )
          })
      })
  }
