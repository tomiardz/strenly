import { createGroupItem } from '@strenly/core/domain/entities/program/group-item'
import type { ExerciseRepositoryPort } from '@strenly/core/ports/exercise-repository.port'
import type { ProgramExerciseRow, ProgramRepositoryPort } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type AddExerciseRowInput = OrganizationContext & {
  sessionId: string
  exerciseId: string
  groupId?: string | null
}

export type AddExerciseRowResult = {
  row: ProgramExerciseRow
  exerciseName: string
}

export type AddExerciseRowError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; entityType: 'session'; id: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
  exerciseRepository: ExerciseRepositoryPort
  generateId: () => string
}

export const makeAddExerciseRow =
  (deps: Dependencies) =>
  (input: AddExerciseRowInput): ResultAsync<AddExerciseRowResult, AddExerciseRowError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to modify programs',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }
    const now = new Date()

    // 2. Get max order index to append at end
    return deps.programRepository
      .getMaxExerciseRowOrderIndex(ctx, input.sessionId)
      .mapErr((e): AddExerciseRowError => {
        if (e.type === 'NOT_FOUND') {
          return { type: 'not_found', entityType: 'session', id: e.id }
        }
        return { type: 'repository_error', message: e.message }
      })
      .andThen((maxOrder) => {
        // 3. Validate via domain factory
        const itemResult = createGroupItem({
          id: deps.generateId(),
          exerciseId: input.exerciseId,
          orderIndex: maxOrder + 1,
        })

        if (itemResult.isErr()) {
          return errAsync<AddExerciseRowResult, AddExerciseRowError>({
            type: 'validation_error',
            message: itemResult.error.message,
          })
        }

        const row: Omit<ProgramExerciseRow, 'sessionId'> = {
          id: itemResult.value.id,
          exerciseId: itemResult.value.exerciseId,
          orderIndex: itemResult.value.orderIndex,
          groupId: input.groupId ?? null,
          orderWithinGroup: null,
          setTypeLabel: null,
          notes: null,
          restSeconds: null,
          createdAt: now,
          updatedAt: now,
        }

        return deps.programRepository
          .createExerciseRow(ctx, input.sessionId, row)
          .mapErr((e): AddExerciseRowError => {
            if (e.type === 'NOT_FOUND') {
              return { type: 'not_found', entityType: 'session', id: e.id }
            }
            return { type: 'repository_error', message: e.message }
          })
          .andThen((createdRow) => {
            // 4. Fetch exercise name for the response
            return deps.exerciseRepository
              .findById(ctx, createdRow.exerciseId)
              .map(
                (exercise): AddExerciseRowResult => ({
                  row: createdRow,
                  exerciseName: exercise?.name ?? 'Unknown',
                }),
              )
              .mapErr(
                (e): AddExerciseRowError => ({
                  type: 'repository_error',
                  message: e.type === 'DATABASE_ERROR' ? e.message : 'Failed to fetch exercise',
                }),
              )
          })
      })
  }
