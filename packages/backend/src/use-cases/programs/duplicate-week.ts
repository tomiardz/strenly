import { createWeek } from '@strenly/core/domain/entities/program/week'
import type { ProgramRepositoryPort, ProgramWeek } from '@strenly/core/ports/program-repository.port'
import { hasPermission } from '@strenly/core/services/authorization'
import type { OrganizationContext } from '@strenly/core/types/organization-context'
import { errAsync, type ResultAsync } from 'neverthrow'

export type DuplicateWeekInput = OrganizationContext & {
  programId: string
  weekId: string
  name?: string
}

export type DuplicateWeekError =
  | { type: 'forbidden'; message: string }
  | { type: 'not_found'; weekId: string }
  | { type: 'program_not_found'; programId: string }
  | { type: 'validation_error'; message: string }
  | { type: 'repository_error'; message: string }

type Dependencies = {
  programRepository: ProgramRepositoryPort
  generateId: () => string
}

export const makeDuplicateWeek =
  (deps: Dependencies) =>
  (input: DuplicateWeekInput): ResultAsync<ProgramWeek, DuplicateWeekError> => {
    // 1. Authorization FIRST
    if (!hasPermission(input.roles, 'programs:write')) {
      return errAsync({
        type: 'forbidden',
        message: 'No permission to modify programs',
      })
    }

    const ctx = { organizationId: input.organizationId, userId: input.userId, roles: input.roles }

    // 2. Get program details to find source week name
    return deps.programRepository
      .findWithDetails(ctx, input.programId)
      .mapErr(
        (e): DuplicateWeekError => ({
          type: 'repository_error',
          message: e.type === 'DATABASE_ERROR' ? e.message : `Not found: ${e.id}`,
        }),
      )
      .andThen((program) => {
        if (!program) {
          return errAsync<ProgramWeek, DuplicateWeekError>({ type: 'program_not_found', programId: input.programId })
        }
        // 3. Find the source week
        const sourceWeek = program.weeks.find((w) => w.id === input.weekId)
        if (!sourceWeek) {
          return errAsync<ProgramWeek, DuplicateWeekError>({
            type: 'not_found',
            weekId: input.weekId,
          })
        }

        // 4. Validate new name via domain factory
        const newName = input.name ?? `${sourceWeek.name} (copia)`
        const weekResult = createWeek({ id: sourceWeek.id, name: newName, orderIndex: sourceWeek.orderIndex })

        if (weekResult.isErr()) {
          return errAsync<ProgramWeek, DuplicateWeekError>({
            type: 'validation_error',
            message: weekResult.error.message,
          })
        }

        // 5. Duplicate the week via repository (copies all prescriptions)
        return deps.programRepository.duplicateWeek(ctx, input.weekId, weekResult.value.name).mapErr(
          (e): DuplicateWeekError => ({
            type: 'repository_error',
            message: e.type === 'DATABASE_ERROR' ? e.message : `Week not found: ${input.weekId}`,
          }),
        )
      })
  }
