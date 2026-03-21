import { createWeek } from '@strenly/core/domain/entities/program/week'
import type { ProgramRepositoryPort, ProgramWeek } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type UpdateWeekInput = OrganizationContext & {
  weekId: string
  name: string
}

export type UpdateWeekError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; weekId: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
}

export const makeUpdateWeek =
  (deps: Dependencies) =>
  (input: UpdateWeekInput): ResultAsync<ProgramWeek, UpdateWeekError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to modify programs',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }

    // 2. Fetch existing week to preserve its orderIndex
    return deps.programRepository
      .findWeekById(ctx, input.weekId)
      .mapErr(
        (e): UpdateWeekError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
      .andThen((existing) => {
        if (!existing) {
          return errAsync<ProgramWeek, UpdateWeekError>({ type: 'not_found', weekId: input.weekId })
        }
        // 3. Validate via domain factory (handles trim)
        const weekResult = createWeek({ id: existing.id, name: input.name, orderIndex: existing.orderIndex })

        if (weekResult.isErr()) {
          return errAsync<ProgramWeek, UpdateWeekError>({
            type: 'validation_error',
            message: weekResult.error.message,
          })
        }

        const week: ProgramWeek = {
          id: existing.id,
          programId: existing.programId,
          name: weekResult.value.name,
          orderIndex: existing.orderIndex,
          createdAt: existing.createdAt,
          updatedAt: new Date(),
        }

        return deps.programRepository.updateWeek(ctx, week).mapErr((e): UpdateWeekError => {
          if (e.type === 'NOT_FOUND') {
            return { type: 'not_found', weekId: input.weekId }
          }
          return { type: 'repository_error', message: e.message }
        })
      })
  }
