import { createWeek } from '@strenly/core/domain/entities/program/week'
import type { ProgramRepositoryPort, ProgramWeek } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type AddWeekInput = OrganizationContext & {
  programId: string
  name?: string
}

export type AddWeekError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; programId: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
  generateId: () => string
}

export const makeAddWeek =
  (deps: Dependencies) =>
  (input: AddWeekInput): ResultAsync<ProgramWeek, AddWeekError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to modify programs',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }

    // 2. Find program with details to get current week count
    return deps.programRepository
      .findWithDetails(ctx, input.programId)
      .mapErr(
        (e): AddWeekError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
      .andThen((program) => {
        if (!program) {
          return errAsync<ProgramWeek, AddWeekError>({ type: 'not_found', programId: input.programId })
        }
        // 3. Calculate orderIndex and validate via domain factory
        const nextOrderIndex = program.weeks.length
        const weekResult = createWeek({ id: deps.generateId(), name: input.name, orderIndex: nextOrderIndex })

        if (weekResult.isErr()) {
          return errAsync<ProgramWeek, AddWeekError>({
            type: 'validation_error',
            message: weekResult.error.message,
          })
        }

        const now = new Date()
        const week: Omit<ProgramWeek, 'programId'> = {
          id: weekResult.value.id,
          name: weekResult.value.name,
          orderIndex: weekResult.value.orderIndex,
          createdAt: now,
          updatedAt: now,
        }

        // 4. Create week via repository
        return deps.programRepository.createWeek(ctx, input.programId, week).mapErr(
          (e): AddWeekError => ({
            type: 'repository_error',
            message: e.type === 'DATABASE_ERROR' ? e.message : `Program not found: ${input.programId}`,
          }),
        )
      })
  }
